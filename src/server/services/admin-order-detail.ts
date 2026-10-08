import "server-only";
import { eq } from "drizzle-orm";
import { orders, orderItems, shipments } from "@/server/db/schema";
import { withStaff } from "@/server/auth/authorize";
import { AppError } from "@/lib/errors";


export async function getAdminOrderFull(orderId: string) {
  return withStaff("orders.read", async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) throw new AppError("NOT_FOUND");
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const [shipment] = await tx.select().from(shipments).where(eq(shipments.orderId, orderId)).limit(1);
    return { order, items, shipment: shipment || null };
  });
}
