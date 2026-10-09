import { beforeAll, afterAll, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { startTestDatabase } from "./database";
import * as s from "@/server/db/schema";
import { bootstrapOwner } from "@/server/services/bootstrap";
import type { Database, Transaction } from "@/server/db/operations";
import { verifyPayment, rejectPayment } from "@/server/services/payments";
import {
  getPaymentQueue,
  getPaymentDetail,
  getAdminPaymentProofUrl,
} from "@/server/services/admin-payments";
import { AppError } from "@/lib/errors";

let database: Awaited<ReturnType<typeof startTestDatabase>>;
const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/server/db", () => ({ getDatabase: () => database.db }));
vi.mock("@/server/auth", () => ({
  auth: authMock,
  authenticationEnabled: () => true,
}));

vi.mock("@/server/storage/r2", () => ({
  getStorage: () => ({
    privateProofUrl: async (key: string) => ({
      url: `https://mock.invalid/${key}`,
      expiresIn: 3600,
    }),
  }),
}));

let adminId: string;
let operatorId: string;

beforeAll(async () => {
  database = await startTestDatabase();
  const res = await bootstrapOwner(database.db, {
    name: "Admin",
    email: "admin@test.invalid",
    password: "Password123456789",
  });
  adminId = res.id;
  operatorId = res.id;
});

afterAll(async () => {
  await database.stop();
});

beforeEach(() => {
  authMock.mockResolvedValue({ user: { id: adminId, sessionVersion: 0 } });
});

async function createPaymentReadyOrder(
  db: Database,
  statusOverride?: "expired",
) {
  return db.transaction(async (tx: Transaction) => {
    const [category] = await tx
      .insert(s.categories)
      .values({
        name: "Test",
        slug: randomUUID(),
      })
      .returning();

    const [product] = await tx
      .insert(s.products)
      .values({
        name: "T-Shirt",
        sku: randomUUID().substring(0, 8),
        slug: randomUUID(),
        description: "A test shirt",
        categoryId: category!.id,
        conditionGrade: "A",
        conditionNotes: "",
        defectNotes: "",
        sizeLabel: "M",
        weightGrams: 500,
        status: "active",
        price: 100000,
        quantity: 10,
      })
      .returning();

    const [bank] = await tx
      .insert(s.bankAccounts)
      .values({
        bankName: "Bank Test",
        accountNumber: "1234",
        accountHolder: "PT Test",
        sortOrder: 1,
        active: true,
      })
      .returning();

    const [customer] = await tx
      .insert(s.customers)
      .values({
        name: "Buyer",
        email: "b@test.invalid",
        phone: "0811",
      })
      .returning();

    const [address] = await tx
      .insert(s.addresses)
      .values({
        customerId: customer!.id,
        recipientName: "B",
        phone: "0811",
        addressLine: "Jalan",
        city: "C",
        district: "D",
        province: "P",
        postalCode: "1",
      })
      .returning();

    const [quote] = await tx
      .insert(s.shippingQuotes)
      .values({
        customerId: customer!.id,
        addressId: address!.id,
        cartFingerprint: (randomUUID() + randomUUID())
          .replace(/-/g, "")
          .toLowerCase(),
        contextFingerprint: (randomUUID() + randomUUID())
          .replace(/-/g, "")
          .toLowerCase(),
        provider: "test",
        courierName: "JNE",
        serviceName: "REG",
        courier: "JNE",
        service: "REG",
        cost: 10000,
        etd: "1-2 days",
        expiresAt: new Date(Date.now() + 86400000),
      })
      .returning();

    const [order] = await tx
      .insert(s.orders)
      .values({
        orderNumber: randomUUID().substring(0, 8).toUpperCase(),
        publicTokenHash: (randomUUID() + randomUUID())
          .replace(/-/g, "")
          .toLowerCase(),
        idempotencyKey: randomUUID(),
        requestHash: randomUUID(),
        shippingQuoteId: quote!.id,
        customerId: customer!.id,
        addressId: address!.id,
        addressSnapshot: {
          recipientName: "B",
          phone: "0811",
          addressLine: "Jalan",
          city: "C",
          province: "P",
          postalCode: "1",
          district: "D",
          subdistrict: null,
        },
        shippingProvider: "test",
        shippingCourier: "JNE",
        shippingService: "REG",
        shippingCost: 10000,
        subtotal: 100000,
        merchandiseTotal: 100000,
        discountTotal: 0,
        grandTotal: 110000,
        paymentDueAt: new Date(Date.now() + 86400000),
        status: statusOverride ?? "payment_submitted",
      })
      .returning();

    await tx.insert(s.orderItems).values({
      orderId: order!.id,
      productId: product!.id,
      quantity: 1,
      lineTotal: 100000,
      priceSnapshot: 100000,
      skuSnapshot: product!.sku,
      slugSnapshot: product!.slug,
      nameSnapshot: product!.name,
      sizeSnapshot: product!.sizeLabel,
      conditionSnapshot: product!.conditionGrade ?? "A",
      originalLineTotal: 100000,
    });

    await tx.insert(s.reservations).values({
      orderId: order!.id,
      productId: product!.id,
      quantity: 1,
      expiresAt: new Date(Date.now() + 86400000),
    });

    const [payment] = await tx
      .insert(s.payments)
      .values({
        orderId: order!.id,
        bankAccountId: bank!.id,
        bankSnapshot: {
          bankName: bank!.bankName,
          accountNumber: bank!.accountNumber,
          accountHolder: bank!.accountHolder,
        },
        expectedAmount: 110000,
        status: statusOverride === "expired" ? "rejected" : "submitted",
        rejectionReason: statusOverride === "expired" ? "Expired order" : null,
        proofObjectKey: "payment-proof/test.jpg",
        proofMime: "image/jpeg",
        proofBytes: 100,
        submittedAt: new Date(),
      })
      .returning();

    return { order, payment, product };
  });
}

it("allows operator with payments.verify permission to view and verify payment", async () => {
  const { order, payment } = await createPaymentReadyOrder(database.db);
  authMock.mockResolvedValue({ user: { id: operatorId, sessionVersion: 0 } }); // operator role has payments.verify

  const queue = await getPaymentQueue({ status: "submitted" });
  expect(queue.items.length).toBeGreaterThan(0);

  const detail = await getPaymentDetail(payment!.id);
  expect(detail.payment!.id).toBe(payment!.id);

  const proofUrl = await getAdminPaymentProofUrl(payment!.id);
  expect(proofUrl.url).toContain("payment-proof/test.jpg");

  const res = await verifyPayment(order!.id);
  expect(res.status).toBe("verified");

  const [updatedOrder] = await database.db
    .select()
    .from(s.orders)
    .where(eq(s.orders.id, order!.id));
  expect(updatedOrder!.status).toBe("payment_verified");

  const [updatedPayment] = await database.db
    .select()
    .from(s.payments)
    .where(eq(s.payments.id, payment!.id));
  expect(updatedPayment!.status).toBe("verified");
  expect(updatedPayment!.verifiedBy).toBe(operatorId);

  const [audit] = await database.db
    .select()
    .from(s.auditLogs)
    .where(eq(s.auditLogs.entityId, payment!.id));
  expect(audit!.action).toBe("payment.verified");
});

it("allows operator to reject payment", async () => {
  const { order, payment } = await createPaymentReadyOrder(database.db);
  authMock.mockResolvedValue({ user: { id: operatorId, sessionVersion: 0 } });

  const res = await rejectPayment({
    orderId: order!.id,
    reason: "Blurry image",
  });
  expect(res.status).toBe("rejected");

  const [updatedOrder] = await database.db
    .select()
    .from(s.orders)
    .where(eq(s.orders.id, order!.id));
  expect(updatedOrder!.status).toBe("pending_payment");

  const [updatedPayment] = await database.db
    .select()
    .from(s.payments)
    .where(eq(s.payments.id, payment!.id));
  expect(updatedPayment!.status).toBe("rejected");
  expect(updatedPayment!.rejectionReason).toBe("Blurry image");
});

it("rejects unauthorized access", async () => {
  authMock.mockResolvedValue({ user: null });
  await expect(getPaymentQueue()).rejects.toThrow(AppError);
});

it("prevents double verification", async () => {
  const { order } = await createPaymentReadyOrder(database.db);

  await verifyPayment(order!.id);

  // Try verifying again
  const res = await verifyPayment(order!.id);
  expect(res.alreadyVerified).toBe(true);

  const outbox = await database.db
    .select()
    .from(s.analyticsOutbox)
    .where(eq(s.analyticsOutbox.orderId, order!.id));
  expect(outbox.length).toBe(1);
  expect(outbox[0]!.eventType).toBe("purchase");
  expect((outbox[0]!.payload as Record<string, unknown>).transaction_id).toBe(
    order!.orderNumber,
  );
});

it("prevents verification of expired order", async () => {
  const { order } = await createPaymentReadyOrder(database.db, "expired");

  await expect(verifyPayment(order!.id)).rejects.toThrow(AppError);
});
