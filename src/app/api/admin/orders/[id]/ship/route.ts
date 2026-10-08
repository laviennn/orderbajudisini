import "server-only";
import { eq } from "drizzle-orm";
import { orders, shipments, orderStatusHistory, auditLogs } from "@/server/db/schema";
import { withStaff } from "@/server/auth/authorize";
import { AppError } from "@/lib/errors";
import { NextResponse } from "next/server";

type ShipPayload = {
  courier: string;
  service: string;
  trackingNumber: string;
  shippedAt?: string; // ISO string
  note?: string;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (req.method !== "POST") throw new AppError("FORBIDDEN");
  const { id } = await params;
  const payload: ShipPayload = await req.json();
  const updated = await shipOrder(id, payload);
  return NextResponse.json(updated);
}

async function shipOrder(orderId: string, data: ShipPayload) {
  return withStaff("shipments.update", async (tx, actor) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) throw new AppError("NOT_FOUND");
    if (order.status !== "processing") {
      throw new AppError("INVALID_ORDER_TRANSITION");
    }
    const [shipment] = await tx.select().from(shipments).where(eq(shipments.orderId, orderId)).for("update").limit(1);
    if (!shipment) throw new AppError("NOT_FOUND");
    if (shipment.status !== "pending") {
      throw new AppError("INVALID_ORDER_TRANSITION");
    }
    if (!data.trackingNumber || data.trackingNumber.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR");
    }
    const shippedAt = data.shippedAt ? new Date(data.shippedAt) : new Date();

    const [updatedOrder] = await tx.update(orders).set({ status: "shipped", updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();

    await tx.update(shipments).set({
      courier: data.courier,
      service: data.service,
      trackingNumber: data.trackingNumber,
      shippedAt,
      status: "shipped",
      updatedAt: new Date(),
      updatedBy: actor.id,
    }).where(eq(shipments.id, shipment.id));

    await tx.insert(orderStatusHistory).values({
      orderId,
      fromStatus: "processing",
      toStatus: "shipped",
      actorUserId: actor.id,
      note: data.note,
    });

    await tx.insert(auditLogs).values({
      actorUserId: actor.id,
      action: "order.ship",
      entityType: "order",
      entityId: orderId,
      metadata: {
        from: "processing",
        to: "shipped",
        trackingNumber: data.trackingNumber,
        courier: data.courier,
        service: data.service,
      },
    });

    return updatedOrder;
  });
}
