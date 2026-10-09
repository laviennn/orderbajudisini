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

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
import { POST as verifyRoute } from "@/app/api/admin/payments/[id]/verify/route";
import { POST as rejectRoute } from "@/app/api/admin/payments/[id]/reject/route";
import { POST as processRoute } from "@/app/api/admin/orders/[id]/process/route";
import { POST as shipRoute } from "@/app/api/admin/orders/[id]/ship/route";
import { POST as completeRoute } from "@/app/api/admin/orders/[id]/complete/route";
import { POST as cancelRoute } from "@/app/api/admin/orders/[id]/cancel/route";
import {
  getAdminOrderDetail,
  getAdminOrders,
} from "@/server/services/admin-orders";
const request = (body: unknown = {}, origin = "http://localhost") =>
  new Request("http://localhost/api/admin/test", {
    method: "POST",
    headers: { host: "localhost", origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const context = (id: string) => ({ params: Promise.resolve({ id }) });
it("binds payment verification to payment URL and runs the idempotent fulfillment state machine", async () => {
  const { order, payment } = await createPaymentReadyOrder(database.db);
  const oid = context(order!.id),
    pid = context(payment!.id);
  expect(
    (await verifyRoute(request({ orderId: randomUUID() }), pid)).status,
  ).toBe(400);
  expect(
    (await verifyRoute(request({}, "https://other.invalid"), pid)).status,
  ).toBe(403);
  const verified = await verifyRoute(request(), pid);
  expect(verified.status).toBe(200);
  expect(await verified.json()).toMatchObject({
    id: payment!.id,
    status: "verified",
  });
  expect((await completeRoute(request(), oid)).status).toBe(409);
  for (let i = 0; i < 2; i++)
    expect((await processRoute(request(), oid)).status).toBe(200);
  expect(
    (
      await shipRoute(
        request({ courier: "TEST", service: "TEST", trackingNumber: " " }),
        oid,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await shipRoute(
        request({
          courier: "TEST",
          service: "REG",
          trackingNumber: "TEST-RESI-1",
        }),
        oid,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await shipRoute(
        request({
          courier: "TEST",
          service: "REG",
          trackingNumber: "TEST-RESI-2",
        }),
        oid,
      )
    ).status,
  ).toBe(200);
  for (let i = 0; i < 2; i++)
    expect((await completeRoute(request(), oid)).status).toBe(200);
  expect((await cancelRoute(request(), oid)).status).toBe(409);
  const detail = await getAdminOrderDetail(order!.id);
  expect(detail.order.status).toBe("completed");
  expect(detail.shipment).toMatchObject({
    status: "delivered",
    trackingNumber: "TEST-RESI-2",
  });
  expect(detail.history.filter((h) => h.to === "processing")).toHaveLength(1);
  expect(detail.history.filter((h) => h.to === "shipped")).toHaveLength(1);
  expect(detail.history.filter((h) => h.to === "completed")).toHaveLength(1);
  expect(JSON.stringify(detail)).not.toMatch(
    /publicToken|proofToken|passwordHash/,
  );
  const results = await getAdminOrders({
    q: order!.orderNumber,
    status: "completed",
    pageSize: 1,
  });
  expect(results.total).toBe(1);
  expect(results.items[0]?.id).toBe(order!.id);
});
it("rejects by payment ID, ignores no forged order identity, and releases cancelled inventory exactly once", async () => {
  const { order, payment, product } = await createPaymentReadyOrder(
    database.db,
  );
  const pid = context(payment!.id),
    oid = context(order!.id);
  expect(
    (await rejectRoute(request({ orderId: randomUUID(), reason: "TEST" }), pid))
      .status,
  ).toBe(400);
  expect(
    (await rejectRoute(request({ reason: "TEST bukti tidak terbaca" }), pid))
      .status,
  ).toBe(200);
  const results = await Promise.all([
    cancelRoute(request(), oid),
    cancelRoute(request(), oid),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  const [updated] = await database.db
    .select()
    .from(s.products)
    .where(eq(s.products.id, product!.id));
  expect(updated?.quantity).toBe(product!.quantity + 1);
  const [reservation] = await database.db
    .select()
    .from(s.reservations)
    .where(eq(s.reservations.orderId, order!.id));
  expect(reservation?.status).toBe("released");
  const history = await database.db
    .select()
    .from(s.orderStatusHistory)
    .where(eq(s.orderStatusHistory.orderId, order!.id));
  expect(history.filter((h) => h.toStatus === "cancelled")).toHaveLength(1);
  const detail = await getPaymentDetail(payment!.id);
  expect(detail.payment.rejectionReason).toBe("TEST bukti tidak terbaca");
  expect(JSON.stringify(detail)).not.toMatch(/Token|proofObjectKey/);
});
it("rejects insufficient staff permissions and malformed IDs on direct operational routes", async () => {
  const [role] = await database.db
    .select()
    .from(s.roles)
    .where(eq(s.roles.name, "Catalog Operator"));
  const [catalog] = await database.db
    .insert(s.users)
    .values({
      name: "TEST Catalog",
      email: "catalog-admin-ops@test.invalid",
      roleId: role!.id,
      status: "active",
    })
    .returning();
  authMock.mockResolvedValue({ user: { id: catalog!.id, sessionVersion: 0 } });
  expect((await processRoute(request(), context(randomUUID()))).status).toBe(
    403,
  );
  expect((await verifyRoute(request(), context(randomUUID()))).status).toBe(
    403,
  );
  authMock.mockResolvedValue({ user: { id: adminId, sessionVersion: 0 } });
  expect((await processRoute(request(), context("bad-id"))).status).toBe(400);
  authMock.mockResolvedValue(null);
  expect((await cancelRoute(request(), context(randomUUID()))).status).toBe(
    401,
  );
});
