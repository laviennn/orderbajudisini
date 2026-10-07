import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getDatabase } from "@/server/db";
import { databaseOperation } from "@/server/db/operations";
import { orders, payments, paymentProofReceipts } from "@/server/db/schema";
import { withStaff } from "@/server/auth/authorize";
import { canTransitionPayment } from "@/lib/domain/states";
import { hashToken } from "./orders";
import { finishReservations } from "./inventory";
import { writeOrderState } from "./order-state";
import { writeAudit } from "./audit";
// No upload route is exposed. A validated receipt must already have been issued by the trusted media pipeline.
export async function submitAcceptedPaymentProof(input: unknown) {
  return databaseOperation(async () => {
    const data = z
      .object({
        orderId: z.uuid(),
        publicToken: z.string().regex(/^[a-f0-9]{64}$/),
        receiptId: z.uuid(),
      })
      .strict()
      .parse(input);
    return getDatabase().transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, data.orderId),
            eq(orders.publicTokenHash, hashToken(data.publicToken)),
          ),
        )
        .for("update");
      if (!order) throw new AppError("NOT_FOUND");
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.orderId, order.id))
        .for("update");
      const [receipt] = await tx
        .select()
        .from(paymentProofReceipts)
        .where(
          and(
            eq(paymentProofReceipts.id, data.receiptId),
            eq(paymentProofReceipts.orderId, order.id),
          ),
        )
        .for("update");
      if (!payment || !receipt) throw new AppError("NOT_FOUND");
      if (
        receipt.consumedAt &&
        payment.proofObjectKey === receipt.objectKey &&
        payment.status === "submitted"
      )
        return { status: "submitted" as const };
      if (
        order.status !== "pending_payment" ||
        !canTransitionPayment(payment.status, "submitted")
      )
        throw new AppError("INVALID_PAYMENT_TRANSITION");
      const [fresh] = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.id, order.id),
            gt(orders.paymentDueAt, sql`clock_timestamp()`),
          ),
        );
      if (!fresh) throw new AppError("RESERVATION_EXPIRED");
      const accepted = await tx
        .update(paymentProofReceipts)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(paymentProofReceipts.id, receipt.id),
            isNull(paymentProofReceipts.consumedAt),
            gt(paymentProofReceipts.expiresAt, sql`clock_timestamp()`),
          ),
        )
        .returning({ id: paymentProofReceipts.id });
      if (!accepted.length) throw new AppError("RESERVATION_EXPIRED");
      await tx
        .update(payments)
        .set({
          status: "submitted",
          proofObjectKey: receipt.objectKey,
          proofMime: receipt.mime,
          proofBytes: receipt.bytes,
          submittedAt: new Date(),
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
      await writeOrderState(tx, order, "payment_submitted", null);
      return { status: "submitted" as const };
    });
  });
}
export async function verifyPayment(orderId: string) {
  return withStaff("payments.verify", async (tx, actor) => {
    z.uuid().parse(orderId);
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");
    if (!order) throw new AppError("NOT_FOUND");
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .for("update");
    if (!payment) throw new AppError("NOT_FOUND");
    if (payment.status === "verified")
      return {
        id: payment.id,
        status: "verified" as const,
        alreadyVerified: true,
      };
    if (
      order.status !== "payment_submitted" ||
      !canTransitionPayment(payment.status, "verified") ||
      payment.expectedAmount !== order.grandTotal
    )
      throw new AppError("INVALID_PAYMENT_TRANSITION");
    await finishReservations(tx, order.id, "sold");
    await tx
      .update(payments)
      .set({
        status: "verified",
        verifiedBy: actor.id,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));
    await writeOrderState(tx, order, "payment_verified", actor.id);
    await writeAudit(tx, {
      actorId: actor.id,
      action: "payment.verified",
      entityType: "payment",
      entityId: payment.id,
    });
    return {
      id: payment.id,
      status: "verified" as const,
      alreadyVerified: false,
    };
  });
}
export async function rejectPayment(input: unknown) {
  return withStaff("payments.verify", async (tx, actor) => {
    const data = z
      .object({ orderId: z.uuid(), reason: z.string().trim().min(1).max(1000) })
      .strict()
      .parse(input);
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, data.orderId))
      .for("update");
    if (!order) throw new AppError("NOT_FOUND");
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .for("update");
    if (!payment) throw new AppError("NOT_FOUND");
    if (payment.status === "verified")
      throw new AppError("PAYMENT_ALREADY_VERIFIED");
    if (payment.status === "rejected" && order.status === "pending_payment")
      return { status: "rejected" as const };
    if (
      order.status !== "payment_submitted" ||
      !canTransitionPayment(payment.status, "rejected")
    )
      throw new AppError("INVALID_PAYMENT_TRANSITION");
    await tx
      .update(payments)
      .set({
        status: "rejected",
        rejectionReason: data.reason,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));
    await writeOrderState(tx, order, "pending_payment", actor.id);
    await writeAudit(tx, {
      actorId: actor.id,
      action: "payment.rejected",
      entityType: "payment",
      entityId: payment.id,
    });
    // No silent deadline extension. Expiry worker releases an already-overdue rejected order.
    return { status: "rejected" as const };
  });
}
