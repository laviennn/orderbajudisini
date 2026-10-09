import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { orders, payments, orderItems } from "@/server/db/schema";
import { withStaff } from "@/server/auth/authorize";
import { AppError } from "@/lib/errors";
import { getStorage } from "@/server/storage/r2";

export interface GetPaymentQueueOptions {
  status?: "pending" | "submitted" | "verified" | "rejected";
  page?: number;
  pageSize?: number;
}

export async function getPaymentQueue(options: GetPaymentQueueOptions = {}) {
  return withStaff("payments.verify", async (tx) => {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));

    const items = await tx
      .select({
        paymentId: payments.id,
        orderId: orders.id,
        orderTokenHash: orders.publicTokenHash,
        addressSnapshot: orders.addressSnapshot,
        grandTotal: orders.grandTotal,
        expectedAmount: payments.expectedAmount,
        status: payments.status,
        submittedAt: payments.submittedAt,
        proofObjectKey: payments.proofObjectKey,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(options.status ? eq(payments.status, options.status) : undefined)
      .orderBy(desc(payments.submittedAt), desc(payments.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const countQuery = tx
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(options.status ? eq(payments.status, options.status) : undefined);
    const countResult = await countQuery;
    const count = countResult[0]?.count ?? 0;

    return {
      items,
      total: Number(count),
      page,
      pageSize,
      totalPages: Math.ceil(Number(count) / pageSize),
    };
  });
}

export async function getPaymentDetail(paymentId: string) {
  return withStaff("payments.verify", async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) throw new AppError("NOT_FOUND");

    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, payment.orderId))
      .limit(1);

    if (!order) throw new AppError("NOT_FOUND");

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    return {
      payment,
      order,
      orderItems: items,
    };
  });
}

export async function getAdminPaymentProofUrl(paymentId: string) {
  return withStaff("payments.verify", async (tx) => {
    const [payment] = await tx
      .select({ proofObjectKey: payments.proofObjectKey })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment || !payment.proofObjectKey) {
      throw new AppError("NOT_FOUND");
    }

    const storage = getStorage();
    const { url } = await storage.privateProofUrl(payment.proofObjectKey);
    return { url };
  });
}
