import "server-only";
import { eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { canTransitionOrder, type OrderState } from "@/lib/domain/states";
import { orders, orderStatusHistory } from "@/server/db/schema";
import type { Transaction } from "@/server/db/operations";
import { writeAudit } from "./audit";
export async function writeOrderState(
  tx: Transaction,
  order: { id: string; status: OrderState },
  to: OrderState,
  actorId: string | null,
) {
  if (!canTransitionOrder(order.status, to))
    throw new AppError("INVALID_ORDER_TRANSITION");
  await tx
    .update(orders)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(orders.id, order.id));
  await tx.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: order.status,
    toStatus: to,
    actorUserId: actorId,
  });
  await writeAudit(tx, {
    actorId,
    action: "order.status_changed",
    entityType: "order",
    entityId: order.id,
    metadata: { from: order.status, to },
  });
}
