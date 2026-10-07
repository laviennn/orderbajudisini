import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { withStaff } from "@/server/auth/authorize";
import { orders, shipments } from "@/server/db/schema";
import { writeOrderState } from "./order-state";
import { writeAudit } from "./audit";
export async function recordShipment(input: unknown) {
  return withStaff("shipments.update", async (tx, actor) => {
    const data = z
      .object({
        orderId: z.uuid(),
        trackingNumber: z.string().trim().min(1).max(120),
      })
      .strict()
      .parse(input);
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, data.orderId))
      .for("update");
    if (!order) throw new AppError("NOT_FOUND");
    if (!["processing", "shipped"].includes(order.status))
      throw new AppError("INVALID_ORDER_TRANSITION");
    await tx
      .insert(shipments)
      .values({
        orderId: order.id,
        courier: order.shippingCourier,
        service: order.shippingService,
        trackingNumber: data.trackingNumber,
        status: "shipped",
        shippedAt: new Date(),
        updatedBy: actor.id,
      })
      .onConflictDoUpdate({
        target: shipments.orderId,
        set: {
          trackingNumber: data.trackingNumber,
          updatedBy: actor.id,
          updatedAt: new Date(),
        },
      });
    if (order.status === "processing")
      await writeOrderState(tx, order, "shipped", actor.id);
    await writeAudit(tx, {
      actorId: actor.id,
      action: "tracking.changed",
      entityType: "order",
      entityId: order.id,
      metadata: { changedFields: ["trackingNumber"] },
    });
    return { id: order.id, status: "shipped" as const };
  });
}
