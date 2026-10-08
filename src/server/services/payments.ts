import "server-only";
import { createHmac } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getDatabase } from "@/server/db";
import { databaseOperation } from "@/server/db/operations";
import { orders, payments, paymentProofReceipts } from "@/server/db/schema";
import { withStaff } from "@/server/auth/authorize";
import { canTransitionPayment } from "@/lib/domain/states";
import { getEnvironment } from "@/server/env";
import { hashToken } from "./orders";
import { createOrderToken } from "./order-tokens";
import { finishReservations } from "./inventory";
import { writeOrderState } from "./order-state";
import { writeAudit } from "./audit";
import { getStorage } from "@/server/storage/r2";
import { uploadSchema } from "@/server/storage/policy";
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
        (order.status !== "pending_payment" && order.status !== "payment_submitted") ||
        (!canTransitionPayment(payment.status, "submitted") && payment.status !== "submitted")
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
      const secret = getEnvironment().AUTH_SECRET;
      if (!secret) throw new AppError("NOT_CONFIGURED");

      // Replace old proof if it exists
      const oldKey = payment.proofObjectKey;

      const { token: proofToken, ciphertext: proofTokenCiphertext } = createOrderToken(secret, payment.id);

      await tx
        .update(payments)
        .set({
          status: "submitted",
          proofTokenHash: hashToken(proofToken),
          proofTokenCiphertext,
          proofObjectKey: receipt.objectKey,
          proofMime: receipt.mime,
          proofBytes: receipt.bytes,
          submittedAt: new Date(),
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
      
      if (order.status === "pending_payment") {
        await writeOrderState(tx, order, "payment_submitted", null);
      }
      
      // Cleanup old proof object outside transaction?
      // Since we can't reliably do it in the transaction without side effects,
      // we'll leave it to a cleanup cron, or do it after.
      // Wait, returning the token and oldKey so caller can clean up.
      
      return { status: "submitted" as const, proofToken, oldKey };
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

const authorizeInput = z.object({
  mime: uploadSchema.shape.mime,
  bytes: uploadSchema.shape.bytes,
}).strict();

export async function authorizeProofUpload(publicToken: string, input: unknown) {
  if (!/^[a-f0-9]{64}$/.test(publicToken)) throw new AppError("VALIDATION_ERROR");
  const data = authorizeInput.parse(input);
  return databaseOperation(async () => {
    const db = getDatabase();
    const [order] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.publicTokenHash, hashToken(publicToken)))
      .limit(1);
    if (!order) throw new AppError("NOT_FOUND");
    if (order.status !== "pending_payment" && order.status !== "payment_submitted") {
      throw new AppError("INVALID_ORDER_TRANSITION");
    }

    const [payment] = await db
      .select({ id: payments.id, status: payments.status })
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .limit(1);
    
    if (!payment) throw new AppError("NOT_FOUND");
    if (!canTransitionPayment(payment.status, "submitted") && payment.status !== "submitted") {
      throw new AppError("INVALID_PAYMENT_TRANSITION");
    }

    const storage = getStorage();
    const result = await storage.createUpload({
      purpose: "payment-proof",
      mime: data.mime,
      bytes: data.bytes,
    });
    
    const secret = getEnvironment().AUTH_SECRET;
    if (!secret) throw new AppError("NOT_CONFIGURED");
    const signature = createHmac("sha256", secret).update(result.key).update(order.id).digest("hex");

    return { ...result, signature };
  });
}

const completeInput = z.object({
  key: z.string().startsWith("payment-proof/").regex(/\.(jpg|png|webp)$/),
  signature: z.string().length(64),
}).strict();

export async function completeProofUpload(publicToken: string, input: unknown) {
  if (!/^[a-f0-9]{64}$/.test(publicToken)) throw new AppError("VALIDATION_ERROR");
  const data = completeInput.parse(input);

  return databaseOperation(async () => {
    const db = getDatabase();
    
    const [order] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.publicTokenHash, hashToken(publicToken)))
      .limit(1);
    if (!order) throw new AppError("NOT_FOUND");
    if (order.status !== "pending_payment" && order.status !== "payment_submitted") {
      throw new AppError("INVALID_ORDER_TRANSITION");
    }

    const secret = getEnvironment().AUTH_SECRET;
    if (!secret) throw new AppError("NOT_CONFIGURED");
    const expectedSignature = createHmac("sha256", secret).update(data.key).update(order.id).digest("hex");
    if (data.signature !== expectedSignature) {
      throw new AppError("VALIDATION_ERROR", { file: ["Otorisasi unggahan tidak valid."] });
    }

    const storage = getStorage();
    // Ensure the object actually exists and is the expected size/type
    const metadata = await storage.inspectObject("payment-proof", data.key);

    const body = await storage.readPaymentProof(data.key, 10 * 1024 * 1024);
    if (body.length !== metadata.bytes) throw new AppError("VALIDATION_ERROR");

    // Verify magic bytes
    let isValid = false;
    if (metadata.mime === "image/jpeg" && body.length >= 3) {
      isValid = body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
    } else if (metadata.mime === "image/png" && body.length >= 8) {
      isValid = body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47 && body[4] === 0x0d && body[5] === 0x0a && body[6] === 0x1a && body[7] === 0x0a;
    } else if (metadata.mime === "image/webp" && body.length >= 12) {
      isValid = body[0] === 0x52 && body[1] === 0x49 && body[2] === 0x46 && body[3] === 0x46 && body[8] === 0x57 && body[9] === 0x45 && body[10] === 0x42 && body[11] === 0x50;
    }
    
    if (!isValid) {
      throw new AppError("VALIDATION_ERROR", { file: ["Konten file tidak sesuai format gambar yang didukung."] });
    }

    const receipt = await db.transaction(async (tx) => {
      const [saved] = await tx.insert(paymentProofReceipts).values({
        orderId: order.id,
        objectKey: data.key,
        mime: metadata.mime,
        bytes: metadata.bytes,
        validatedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes to consume
      }).returning();
      return saved;
    });

    const result = await submitAcceptedPaymentProof({
      orderId: order.id,
      publicToken,
      receiptId: receipt!.id
    });

    if (result.oldKey && result.oldKey !== data.key) {
      storage.deleteObject("payment-proof", result.oldKey).catch(() => {});
    }

    return result;
  });
}

export async function resolveProofUrl(proofToken: string) {
  if (!/^[a-f0-9]{64}$/.test(proofToken)) throw new AppError("VALIDATION_ERROR");
  return databaseOperation(async () => {
    const db = getDatabase();
    const [payment] = await db
      .select({ proofObjectKey: payments.proofObjectKey })
      .from(payments)
      .where(eq(payments.proofTokenHash, hashToken(proofToken)))
      .limit(1);
      
    if (!payment || !payment.proofObjectKey) throw new AppError("NOT_FOUND");
    
    const storage = getStorage();
    const result = await storage.privateProofUrl(payment.proofObjectKey);
    return result;
  });
}
