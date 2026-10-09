import "server-only";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  orders,
  payments,
  orderItems,
  orderStatusHistory,
  users,
} from "@/server/db/schema";
import { withStaff } from "@/server/auth/authorize";
import { AppError } from "@/lib/errors";
import { getStorage } from "@/server/storage/r2";
import { paymentStates } from "@/lib/domain/states";
import { listInput, searchPattern } from "@/lib/admin-operations";
import { adminOrderFields } from "./admin-orders";
import { verifyPayment, rejectPayment } from "./payments";
const filterInput = listInput.extend({
  status: z
    .enum(["", ...paymentStates])
    .catch("submitted")
    .default("submitted"),
});
export async function getPaymentQueue(options: unknown = {}) {
  return withStaff("payments.read", async (tx) => {
    const f = filterInput.parse(options);
    const q = searchPattern(f.q);
    const where = and(
      f.status ? eq(payments.status, f.status) : undefined,
      f.q
        ? or(
            ilike(orders.orderNumber, q),
            sql`${orders.addressSnapshot}->>'recipientName' ilike ${q}`,
          )
        : undefined,
    );
    const items = await tx
      .select({
        paymentId: payments.id,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        addressSnapshot: orders.addressSnapshot,
        expectedAmount: payments.expectedAmount,
        status: payments.status,
        submittedAt: payments.submittedAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(where)
      .orderBy(desc(payments.createdAt), desc(payments.id))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize);
    const [count] = await tx
      .select({ count: sql<number>`count(*)::integer` })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(where);
    return {
      items,
      total: count?.count ?? 0,
      ...f,
      totalPages: Math.ceil((count?.count ?? 0) / f.pageSize),
    };
  });
}
export async function getPaymentDetail(paymentId: string) {
  return withStaff("payments.read", async (tx) => {
    z.uuid().parse(paymentId);
    const [payment] = await tx
      .select({
        id: payments.id,
        orderId: payments.orderId,
        expectedAmount: payments.expectedAmount,
        method: payments.method,
        bankSnapshot: payments.bankSnapshot,
        qrisSnapshot: payments.qrisSnapshot,
        status: payments.status,
        submittedAt: payments.submittedAt,
        verifiedAt: payments.verifiedAt,
        verifier: users.name,
        rejectionReason: payments.rejectionReason,
        hasProof: sql<boolean>`${payments.proofObjectKey} is not null`,
      })
      .from(payments)
      .leftJoin(users, eq(users.id, payments.verifiedBy))
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (!payment) throw new AppError("NOT_FOUND");
    const [order] = await tx
      .select(adminOrderFields)
      .from(orders)
      .where(eq(orders.id, payment.orderId));
    if (!order) throw new AppError("NOT_FOUND");
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const history = await tx
      .select({
        id: orderStatusHistory.id,
        to: orderStatusHistory.toStatus,
        createdAt: orderStatusHistory.createdAt,
      })
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, order.id))
      .orderBy(asc(orderStatusHistory.createdAt), asc(orderStatusHistory.id));
    return { payment, order, orderItems: items, history };
  });
}
export async function getAdminPaymentProofUrl(paymentId: string) {
  return withStaff("payments.read", async (tx) => {
    z.uuid().parse(paymentId);
    const [payment] = await tx
      .select({ proofObjectKey: payments.proofObjectKey })
      .from(payments)
      .where(eq(payments.id, paymentId));
    if (!payment?.proofObjectKey) throw new AppError("NOT_FOUND");
    const { url } = await getStorage().privateProofUrl(payment.proofObjectKey);
    return { url };
  });
}
async function orderForPayment(paymentId: string) {
  return withStaff("payments.verify", async (tx) => {
    z.uuid().parse(paymentId);
    const [payment] = await tx
      .select({ orderId: payments.orderId })
      .from(payments)
      .where(eq(payments.id, paymentId));
    if (!payment) throw new AppError("NOT_FOUND");
    return payment.orderId;
  });
}
// The URL identifies a payment, never a browser-supplied order ID. The order relationship is immutable.
export async function verifyAdminPayment(paymentId: string) {
  return verifyPayment(await orderForPayment(paymentId));
}
export async function rejectAdminPayment(paymentId: string, reason: string) {
  return rejectPayment({ orderId: await orderForPayment(paymentId), reason });
}
