import "server-only";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  orders,
  orderItems,
  shipments,
  orderStatusHistory,
  payments,
  users,
  customers,
} from "@/server/db/schema";
import { withStaff } from "@/server/auth/authorize";
import { AppError } from "@/lib/errors";
import { orderStates } from "@/lib/domain/states";
import { listInput, searchPattern } from "@/lib/admin-operations";
import { transitionOrder } from "./orders";
import { recordShipment } from "./shipping";
export const adminOrderFields = {
  id: orders.id,
  orderNumber: orders.orderNumber,
  createdAt: orders.createdAt,
  updatedAt: orders.updatedAt,
  status: orders.status,
  addressSnapshot: orders.addressSnapshot,
  subtotal: orders.subtotal,
  discountTotal: orders.discountTotal,
  merchandiseTotal: orders.merchandiseTotal,
  shippingCost: orders.shippingCost,
  grandTotal: orders.grandTotal,
  shippingCourier: orders.shippingCourier,
  shippingService: orders.shippingService,
  paymentDueAt: orders.paymentDueAt,
  notes: orders.notes,
};
const filterInput = listInput.extend({
  status: z
    .enum(["", ...orderStates])
    .catch("")
    .default(""),
});
export async function getAdminOrders(options: unknown = {}) {
  return withStaff("orders.read", async (tx) => {
    const f = filterInput.parse(options);
    const q = searchPattern(f.q);
    const where = and(
      f.status ? eq(orders.status, f.status) : undefined,
      f.q
        ? or(
            ilike(orders.orderNumber, q),
            sql`${orders.addressSnapshot}->>'recipientName' ilike ${q}`,
          )
        : undefined,
    );
    const items = await tx
      .select({
        ...adminOrderFields,
        paymentStatus: payments.status,
        trackingNumber: shipments.trackingNumber,
      })
      .from(orders)
      .leftJoin(payments, eq(payments.orderId, orders.id))
      .leftJoin(shipments, eq(shipments.orderId, orders.id))
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize);
    const [count] = await tx
      .select({ count: sql<number>`count(*)::integer` })
      .from(orders)
      .where(where);
    return { items, total: count?.count ?? 0, ...f };
  });
}
export async function getAdminOrderDetail(orderId: string) {
  return withStaff("orders.read", async (tx) => {
    z.uuid().parse(orderId);
    const [order] = await tx
      .select(adminOrderFields)
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) throw new AppError("NOT_FOUND");
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.id));
    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, orderId));
    const [payment] = await tx
      .select({
        id: payments.id,
        status: payments.status,
        expectedAmount: payments.expectedAmount,
        method: payments.method,
        submittedAt: payments.submittedAt,
        verifiedAt: payments.verifiedAt,
        rejectionReason: payments.rejectionReason,
      })
      .from(payments)
      .where(eq(payments.orderId, orderId));
    const history = await tx
      .select({
        id: orderStatusHistory.id,
        from: orderStatusHistory.fromStatus,
        to: orderStatusHistory.toStatus,
        note: orderStatusHistory.note,
        createdAt: orderStatusHistory.createdAt,
        actor: users.name,
      })
      .from(orderStatusHistory)
      .leftJoin(users, eq(users.id, orderStatusHistory.actorUserId))
      .where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(asc(orderStatusHistory.createdAt), asc(orderStatusHistory.id));
    const [customer] = await tx
      .select({
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
      })
      .from(customers)
      .innerJoin(orders, eq(orders.customerId, customers.id))
      .where(eq(orders.id, orderId));
    return {
      order,
      orderItems: items,
      shipment: shipment ?? null,
      payment: payment ?? null,
      history,
      customer,
    };
  });
}
export const processOrder = (id: string) =>
  transitionOrder({ id, to: "processing" });
export const completeOrder = (id: string) =>
  transitionOrder({ id, to: "completed" });
export const cancelOrder = (id: string) =>
  transitionOrder({ id, to: "cancelled" });
export const shipOrder = (
  id: string,
  data: { courier: string; service: string; trackingNumber: string },
) => recordShipment({ ...data, orderId: id });

export async function getRevenueSummary() {
  return withStaff("orders.read", async (tx) => {
    const [result] = await tx
      .select({
        totalRevenue: sql<number>`sum(${orders.grandTotal})::integer`,
        orderCount: sql<number>`count(*)::integer`,
      })
      .from(orders)
      .where(or(eq(orders.status, "completed"), eq(orders.status, "processing")));
    return {
      totalRevenue: result?.totalRevenue ?? 0,
      orderCount: result?.orderCount ?? 0,
    };
  });
}
