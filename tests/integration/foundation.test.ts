import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/server/db/operations";
import * as s from "@/server/db/schema";
import { startTestDatabase } from "./database";
let db: Database;
const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/server/db", () => ({ getDatabase: () => db }));
vi.mock("@/server/auth", () => ({
  auth: authMock,
  authenticationEnabled: () => true,
}));
import { bootstrapOwner } from "@/server/services/bootstrap";
import {
  createOperator,
  updateOperator,
  listOperators,
} from "@/server/services/operators";
import { requirePermission } from "@/server/auth/authorize";
import {
  createReservedOrder,
  cartFingerprint,
  releaseExpiredReservations,
  transitionOrder,
} from "@/server/services/orders";
import {
  submitAcceptedPaymentProof,
  verifyPayment,
  rejectPayment,
} from "@/server/services/payments";
import { recordShipment } from "@/server/services/shipping";
import {
  listApprovedReviews,
  approvedReviewSummary,
} from "@/server/repositories/reviews";
import { moderateReview } from "@/server/services/reviews";
import {
  savePromotion,
  setProductPromotionEligibility,
} from "@/server/services/promotions";
import {
  saveBankAccount,
  updateSeoSettings,
  getPublicSeoSettings,
} from "@/server/services/settings";
import { authenticateCredentials } from "@/server/auth/credentials";
import { allowLogin } from "@/server/auth/rate-limit";
import { writeAudit } from "@/server/services/audit";
let instance: Awaited<ReturnType<typeof startTestDatabase>>;
let ownerId: string;
let catalogRole: string;
let orderRole: string;
const ownerPassword = "TEST-ONLY-owner-password-2026!";
const identity = (id: string, sessionVersion = 0) => ({
  user: { id, sessionVersion },
});
beforeAll(async () => {
  instance = await startTestDatabase();
  db = instance.db;
  vi.stubEnv("AUTH_SECRET", "test-secret-".repeat(5));
  const owner = await bootstrapOwner(db, {
    name: "TEST OWNER",
    email: "owner@example.test",
    password: ownerPassword,
  });
  ownerId = owner.id;
  catalogRole = (
    await db.select().from(s.roles).where(eq(s.roles.name, "Catalog Operator"))
  )[0]!.id;
  orderRole = (
    await db.select().from(s.roles).where(eq(s.roles.name, "Order Operator"))
  )[0]!.id;
  await db
    .insert(s.storeSettings)
    .values({ id: 1, storeName: "TEST ONLY STORE", reservationMinutes: 30 });
});
afterAll(async () => {
  await instance?.stop();
  vi.unstubAllEnvs();
});
beforeEach(() => authMock.mockReset().mockResolvedValue(identity(ownerId)));
async function fixture(count = 1, eligible = false, quantity = 1) {
  const suffix = randomUUID();
  const [category] = await db
    .insert(s.categories)
    .values({ name: "TEST CATEGORY", slug: `test-${suffix}` })
    .returning();
  const products = await db
    .insert(s.products)
    .values(
      Array.from({ length: count }, (_, i) => ({
        sku: `TEST-${suffix}-${i}`,
        slug: `test-${suffix}-${i}`,
        name: `TEST PRODUCT ${i}`,
        description: "ISOLATED TEST DATA",
        categoryId: category!.id,
        price: 45000,
        conditionNotes: "TEST condition",
        status: "active" as const,
        quantity,
        weightGrams: 100,
        promotionEligible: eligible,
      })),
    )
    .returning();
  const [customer] = await db
    .insert(s.customers)
    .values({ name: "TEST CUSTOMER", phone: "0000000000" })
    .returning();
  const [address] = await db
    .insert(s.addresses)
    .values({
      customerId: customer!.id,
      recipientName: "TEST RECIPIENT",
      phone: "0000000000",
      addressLine: "TEST ADDRESS",
      province: "TEST",
      city: "TEST",
      district: "TEST",
      postalCode: "00000",
    })
    .returning();
  const [bank] = await db
    .insert(s.bankAccounts)
    .values({
      bankName: "TEST BANK",
      accountNumber: "00000000",
      accountHolder: "TEST ONLY",
      active: true,
    })
    .returning();
  const quoteValues = {
    customerId: customer!.id,
    addressId: address!.id,
    cartFingerprint: cartFingerprint(
      products.map((p) => ({
        productId: p.id,
        quantity: 1,
        weightGrams: p.weightGrams,
      })),
    ),
    provider: "TEST PROVIDER",
    courier: "TEST",
    service: "TEST",
    cost: 10000,
    expiresAt: new Date(Date.now() + 600000),
  };
  const [quote] = await db
    .insert(s.shippingQuotes)
    .values(quoteValues)
    .returning();
  const input = {
    idempotencyKey: randomUUID(),
    customerId: customer!.id,
    addressId: address!.id,
    shippingQuoteId: quote!.id,
    bankAccountId: bank!.id,
    items: products.map((p) => ({ productId: p.id, quantity: 1 })),
  };
  return {
    products,
    customer: customer!,
    address: address!,
    bank: bank!,
    quote: quote!,
    quoteValues,
    input,
  };
}
async function proof(order: { id: string; publicToken: string }) {
  const [receipt] = await db
    .insert(s.paymentProofReceipts)
    .values({
      orderId: order.id,
      objectKey: `payment-proof/${randomUUID()}.png`,
      mime: "image/png",
      bytes: 100,
      validatedAt: new Date(),
      expiresAt: new Date(Date.now() + 600000),
    })
    .returning();
  return submitAcceptedPaymentProof({
    orderId: order.id,
    publicToken: order.publicToken,
    receiptId: receipt!.id,
  });
}
describe("real PostgreSQL foundation", () => {
  it("applies all migrations and enforces SQL price, quantity, rating and unique constraints", async () => {
    const f = await fixture();
    const p = f.products[0]!;
    await expect(
      db.update(s.products).set({ price: -1 }).where(eq(s.products.id, p.id)),
    ).rejects.toThrow();
    await expect(
      db
        .update(s.products)
        .set({ quantity: -1 })
        .where(eq(s.products.id, p.id)),
    ).rejects.toThrow();
    await expect(
      db.insert(s.reviews).values({
        productId: p.id,
        reviewerName: "TEST",
        rating: 6,
        body: "TEST",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(s.categories).values({ name: "TEST", slug: "INVALID SLUG" }),
    ).rejects.toThrow();
    await expect(
      db.insert(s.users).values({
        name: "TEST",
        email: "owner@example.test",
        roleId: catalogRole,
      }),
    ).rejects.toThrow();
  });
  it("bootstrap cannot silently create another owner or repeat", async () => {
    await expect(
      bootstrapOwner(db, {
        name: "TEST AGAIN",
        email: "second@example.test",
        password: ownerPassword,
      }),
    ).rejects.toMatchObject({ code: "BOOTSTRAP_CLOSED" });
    expect(await db.select().from(s.bootstrapState)).toHaveLength(1);
  });
  it("authenticates actual password hashes and uses generic failures", async () => {
    const request = new Request(
      "http://localhost/api/auth/callback/credentials",
    );
    const result = await authenticateCredentials(
      { email: "owner@example.test", password: ownerPassword },
      request,
    );
    expect(result?.id).toBe(ownerId);
    expect(result).not.toHaveProperty("passwordHash");
    expect(
      await authenticateCredentials(
        { email: "owner@example.test", password: "wrong" },
        request,
      ),
    ).toBeNull();
    expect(
      await authenticateCredentials(
        { email: "missing@example.test", password: ownerPassword },
        request,
      ),
    ).toBeNull();
  });
  it("limits login attempts atomically across concurrent requests", async () => {
    const email = `${randomUUID()}@example.test`,
      secret = "isolated-test-key";
    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        allowLogin(db, email, "test-ip", secret),
      ),
    );
    expect(attempts.filter(Boolean)).toHaveLength(5);
  });
  it("enforces service RBAC and invalidates sessions after role/status changes", async () => {
    const user = await createOperator({
      name: "TEST CATALOG",
      email: `${randomUUID()}@example.test`,
      password: ownerPassword,
      roleId: catalogRole,
    });
    expect(user).not.toHaveProperty("passwordHash");
    authMock.mockResolvedValue(identity(user.id));
    await expect(
      createOperator({
        name: "NO",
        email: "no@example.test",
        password: ownerPassword,
        roleId: orderRole,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(verifyPayment(randomUUID())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    authMock.mockResolvedValue(identity(ownerId));
    await updateOperator({ id: user.id, status: "inactive" });
    authMock.mockResolvedValue(identity(user.id));
    await expect(requirePermission("products.read")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    authMock.mockResolvedValue(identity(ownerId));
    await updateOperator({ id: user.id, status: "active", roleId: orderRole });
    const [fresh] = await db
      .select({ version: s.users.sessionVersion })
      .from(s.users)
      .where(eq(s.users.id, user.id));
    authMock.mockResolvedValue(identity(user.id, fresh!.version));
    await expect(requirePermission("products.publish")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect((await requirePermission("payments.verify")).id).toBe(user.id);
    authMock.mockResolvedValue(null);
    await expect(listOperators()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
  it("only one competing quantity-one checkout succeeds, without orphan orders/reservations", async () => {
    const f = await fixture();
    const [q2] = await db
      .insert(s.shippingQuotes)
      .values(f.quoteValues)
      .returning();
    const results = await Promise.allSettled([
      createReservedOrder(f.input),
      createReservedOrder({
        ...f.input,
        idempotencyKey: randomUUID(),
        shippingQuoteId: q2!.id,
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason.code).toBe(
      "PRODUCT_UNAVAILABLE",
    );
    const [p] = await db
      .select()
      .from(s.products)
      .where(eq(s.products.id, f.products[0]!.id));
    expect(p?.quantity).toBe(0);
    expect(p?.status).toBe("reserved");
    expect(
      await db
        .select()
        .from(s.orders)
        .where(eq(s.orders.customerId, f.customer.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(s.reservations)
        .where(eq(s.reservations.productId, p!.id)),
    ).toHaveLength(1);
  });
  it("supports idempotent retries and rejects reused keys with changed inputs", async () => {
    const f = await fixture();
    const [a, b] = await Promise.all([
      createReservedOrder(f.input),
      createReservedOrder(f.input),
    ]);
    expect(a).toEqual(b);
    await expect(
      createReservedOrder({ ...f.input, notes: "changed" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      createReservedOrder({ ...f.input, subtotal: 1 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
  it("rolls back stock and all order records after a late database failure", async () => {
    const f = await fixture();
    await db
      .update(s.bankAccounts)
      .set({ bankName: "TEST-ROLLBACK" })
      .where(eq(s.bankAccounts.id, f.bank.id));
    await instance.pool.query(
      `CREATE FUNCTION test_reject_payment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.bank_snapshot->>'bankName' = 'TEST-ROLLBACK' THEN RAISE EXCEPTION 'TEST rollback' USING ERRCODE='23514'; END IF; RETURN NEW; END; $$; CREATE TRIGGER test_payment_failure BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION test_reject_payment();`,
    );
    await expect(createReservedOrder(f.input)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(
      await db
        .select()
        .from(s.orders)
        .where(eq(s.orders.customerId, f.customer.id)),
    ).toHaveLength(0);
    expect(
      (
        await db
          .select()
          .from(s.products)
          .where(eq(s.products.id, f.products[0]!.id))
      )[0]?.quantity,
    ).toBe(1);
  });
  it("releases expired unpaid reservations exactly once and restores availability", async () => {
    const f = await fixture();
    const order = await createReservedOrder(f.input);
    await db
      .update(s.orders)
      .set({ paymentDueAt: new Date(Date.now() - 1000) })
      .where(eq(s.orders.id, order.id));
    const results = await Promise.all([
      releaseExpiredReservations(),
      releaseExpiredReservations(),
    ]);
    expect(results.reduce((sum, r) => sum + r.expired, 0)).toBe(1);
    expect(
      (
        await db
          .select()
          .from(s.products)
          .where(eq(s.products.id, f.products[0]!.id))
      )[0]?.quantity,
    ).toBe(1);
    expect(
      (await db.select().from(s.orders).where(eq(s.orders.id, order.id)))[0]
        ?.status,
    ).toBe("expired");
    await expect(proof(order)).rejects.toMatchObject({
      code: "INVALID_PAYMENT_TRANSITION",
    });
  });
  it("keeps submitted orders reserved; verification is permission-checked, atomic, and idempotent", async () => {
    const f = await fixture();
    const order = await createReservedOrder(f.input);
    expect(await proof(order)).toEqual({ status: "submitted" });
    const [submitted] = await db
      .select()
      .from(s.payments)
      .where(eq(s.payments.orderId, order.id));
    expect(submitted?.verifiedAt).toBeNull();
    expect(submitted?.status).toBe("submitted");
    await db
      .update(s.orders)
      .set({ paymentDueAt: new Date(Date.now() - 1000) })
      .where(eq(s.orders.id, order.id));
    await releaseExpiredReservations();
    expect(
      (
        await db
          .select()
          .from(s.products)
          .where(eq(s.products.id, f.products[0]!.id))
      )[0]?.status,
    ).toBe("reserved");
    const results = await Promise.all([
      verifyPayment(order.id),
      verifyPayment(order.id),
    ]);
    expect(results.filter((r) => !r.alreadyVerified)).toHaveLength(1);
    const [payment] = await db
      .select()
      .from(s.payments)
      .where(eq(s.payments.orderId, order.id));
    expect(payment?.verifiedBy).toBe(ownerId);
    expect(payment?.verifiedAt).not.toBeNull();
    expect(
      (
        await db
          .select()
          .from(s.products)
          .where(eq(s.products.id, f.products[0]!.id))
      )[0]?.status,
    ).toBe("sold");
    expect(
      await db
        .select()
        .from(s.auditLogs)
        .where(
          and(
            eq(s.auditLogs.entityId, payment!.id),
            eq(s.auditLogs.action, "payment.verified"),
          ),
        ),
    ).toHaveLength(1);
    await expect(
      rejectPayment({ orderId: order.id, reason: "TEST" }),
    ).rejects.toMatchObject({ code: "PAYMENT_ALREADY_VERIFIED" });
    await transitionOrder({ id: order.id, to: "processing" });
    await recordShipment({
      orderId: order.id,
      trackingNumber: "TEST-TRACKING",
    });
    await transitionOrder({ id: order.id, to: "completed" });
    await expect(
      transitionOrder({ id: order.id, to: "cancelled" }),
    ).rejects.toMatchObject({ code: "INVALID_ORDER_TRANSITION" });
  });
  it("rejects proof, allows a new accepted receipt, and denies raw unvalidated proof input", async () => {
    const f = await fixture();
    const order = await createReservedOrder(f.input);
    await expect(
      submitAcceptedPaymentProof({
        orderId: order.id,
        publicToken: order.publicToken,
        receiptId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await proof(order);
    await rejectPayment({ orderId: order.id, reason: "TEST incorrect amount" });
    expect(
      (await db.select().from(s.orders).where(eq(s.orders.id, order.id)))[0]
        ?.status,
    ).toBe("pending_payment");
    await proof(order);
    expect(
      (
        await db
          .select()
          .from(s.payments)
          .where(eq(s.payments.orderId, order.id))
      )[0]?.status,
    ).toBe("submitted");
  });
  it("snapshots multiple bundles and keeps history unchanged after catalog/promotion edits", async () => {
    const f = await fixture(7, true);
    const promotion = await savePromotion({
      name: "TEST 3 for 100K",
      requiredQuantity: 3,
      bundlePrice: 100000,
      active: true,
      startsAt: null,
      endsAt: null,
      priority: 10,
      categoryId: f.products[0]!.categoryId,
      allocationStrategy: "highest_price_first",
      pricePolicy: "discount_only",
      productIds: [],
    });
    const order = await createReservedOrder(f.input);
    expect(order.total).toBe(255000);
    await db
      .update(s.products)
      .set({ name: "TEST RENAMED", price: 999999 })
      .where(
        inArray(
          s.products.id,
          f.products.map((p) => p.id),
        ),
      );
    await savePromotion({
      id: promotion.id,
      name: "TEST MODIFIED",
      requiredQuantity: 3,
      bundlePrice: 120000,
      active: false,
      startsAt: null,
      endsAt: null,
      priority: 10,
      categoryId: f.products[0]!.categoryId,
      allocationStrategy: "highest_price_first",
      pricePolicy: "discount_only",
      productIds: [],
    });
    const snapshots = await db
      .select()
      .from(s.orderPromotions)
      .where(eq(s.orderPromotions.orderId, order.id));
    expect(snapshots[0]?.bundleCount).toBe(2);
    expect(snapshots[0]?.bundlePriceSnapshot).toBe(100000);
    const items = await db
      .select()
      .from(s.orderItems)
      .where(eq(s.orderItems.orderId, order.id));
    expect(items.every((i) => i.priceSnapshot === 45000)).toBe(true);
    expect(items.reduce((sum, i) => sum + i.lineTotal, 0)).toBe(245000);
    await expect(
      db
        .update(s.orderItems)
        .set({ nameSnapshot: "HACK" })
        .where(eq(s.orderItems.orderId, order.id)),
    ).rejects.toThrow();
    await expect(
      db
        .update(s.orders)
        .set({ grandTotal: 1 })
        .where(eq(s.orders.id, order.id)),
    ).rejects.toThrow();
    await expect(
      db
        .update(s.orders)
        .set({ status: "shipped" })
        .where(eq(s.orders.id, order.id)),
    ).rejects.toThrow();
  });
  it("serves only approved reviews and prevents false purchase relationships", async () => {
    const f = await fixture();
    const productId = f.products[0]!.id;
    const [pending] = await db
      .insert(s.reviews)
      .values({
        productId,
        reviewerName: "TEST pending",
        rating: 1,
        body: "TEST hidden",
      })
      .returning();
    const [approved] = await db
      .insert(s.reviews)
      .values({
        productId,
        reviewerName: "TEST approved",
        rating: 5,
        body: "TEST visible",
      })
      .returning();
    const [rejected] = await db
      .insert(s.reviews)
      .values({
        productId,
        reviewerName: "TEST rejected",
        rating: 2,
        body: "TEST hidden",
      })
      .returning();
    await moderateReview({ id: approved!.id, status: "approved" });
    await moderateReview({ id: rejected!.id, status: "rejected" });
    const visible = await listApprovedReviews(productId);
    expect(visible.map((r) => r.id)).toEqual([approved!.id]);
    expect(visible[0]?.verifiedPurchase).toBe(false);
    expect(visible[0]).not.toHaveProperty("orderId");
    expect(await approvedReviewSummary(productId)).toEqual({
      count: 1,
      average: 5,
    });
    expect(
      (
        await db.select().from(s.reviews).where(eq(s.reviews.id, pending!.id))
      )[0]?.status,
    ).toBe("pending");
    const other = await fixture();
    const order = await createReservedOrder(other.input);
    await expect(
      db.insert(s.reviews).values({
        productId,
        orderId: order.id,
        reviewerName: "TEST false",
        rating: 5,
        body: "TEST",
      }),
    ).rejects.toThrow();
  });
  it("audits settings without bank details and refuses secret audit metadata", async () => {
    const bank = await saveBankAccount({
      bankName: "TEST BANK",
      accountNumber: "99990000",
      accountHolder: "TEST HOLDER",
      active: false,
      sortOrder: 0,
    });
    const [audit] = await db
      .select()
      .from(s.auditLogs)
      .where(eq(s.auditLogs.entityId, bank.id));
    expect(JSON.stringify(audit?.metadata)).not.toContain("99990000");
    await expect(
      writeAudit(db, {
        actorId: ownerId,
        action: "bank.updated",
        entityType: "bank_account",
        entityId: bank.id,
        metadata: JSON.parse('{"password":"TEST SECRET"}'),
      }),
    ).rejects.toThrow();
    await expect(
      db.delete(s.auditLogs).where(eq(s.auditLogs.id, audit!.id)),
    ).rejects.toThrow();
    await updateSeoSettings({
      siteTitle: "TEST SITE",
      titleTemplate: "%s | TEST",
      defaultDescription: "TEST DESCRIPTION",
      defaultOgImage: null,
      homepageTitle: null,
      homepageDescription: null,
    });
    expect((await getPublicSeoSettings())?.siteTitle).toBe("TEST SITE");
    const f = await fixture();
    await setProductPromotionEligibility({
      productId: f.products[0]!.id,
      eligible: true,
    });
    expect(
      (
        await db
          .select()
          .from(s.products)
          .where(eq(s.products.id, f.products[0]!.id))
      )[0]?.promotionEligible,
    ).toBe(true);
  });
  it("handles limited stock across sold and released reservations without losing units", async () => {
    const f = await fixture(1, false, 2);
    const [quote] = await db
      .insert(s.shippingQuotes)
      .values(f.quoteValues)
      .returning();
    const first = await createReservedOrder(f.input);
    const second = await createReservedOrder({
      ...f.input,
      idempotencyKey: randomUUID(),
      shippingQuoteId: quote!.id,
    });
    await proof(first);
    await verifyPayment(first.id);
    expect(
      (
        await db
          .select()
          .from(s.products)
          .where(eq(s.products.id, f.products[0]!.id))
      )[0]?.status,
    ).toBe("reserved");
    await transitionOrder({ id: second.id, to: "cancelled" });
    await transitionOrder({ id: second.id, to: "cancelled" });
    const [product] = await db
      .select()
      .from(s.products)
      .where(eq(s.products.id, f.products[0]!.id));
    expect(product?.status).toBe("active");
    expect(product?.quantity).toBe(1);
  });
  it("uses current authoritative prices and rejects a cross-customer shipping quote", async () => {
    const f = await fixture();
    await db
      .update(s.products)
      .set({ price: 50000 })
      .where(eq(s.products.id, f.products[0]!.id));
    expect((await createReservedOrder(f.input)).total).toBe(60000);
    const other = await fixture();
    await expect(
      createReservedOrder({ ...other.input, shippingQuoteId: f.quote.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      db
        .insert(s.shippingQuotes)
        .values({ ...other.quoteValues, customerId: f.customer.id }),
    ).rejects.toThrow();
  });
  it("enforces payment/order consistency in SQL even for a graph-legal direct update", async () => {
    const f = await fixture();
    const order = await createReservedOrder(f.input);
    await expect(
      db
        .update(s.orders)
        .set({ status: "payment_submitted" })
        .where(eq(s.orders.id, order.id)),
    ).rejects.toThrow();
    await expect(
      db
        .update(s.payments)
        .set({
          status: "verified",
          verifiedBy: ownerId,
          verifiedAt: new Date(),
        })
        .where(eq(s.payments.orderId, order.id)),
    ).rejects.toThrow();
  });
  it("marks a review verified only when a completed order contains the product", async () => {
    const f = await fixture();
    const order = await createReservedOrder(f.input);
    await proof(order);
    await verifyPayment(order.id);
    await transitionOrder({ id: order.id, to: "processing" });
    await recordShipment({
      orderId: order.id,
      trackingNumber: "TEST-VERIFIED-REVIEW",
    });
    await transitionOrder({ id: order.id, to: "completed" });
    const [review] = await db
      .insert(s.reviews)
      .values({
        productId: f.products[0]!.id,
        orderId: order.id,
        reviewerName: "TEST VERIFIED",
        rating: 5,
        body: "ISOLATED TEST REVIEW",
      })
      .returning();
    await moderateReview({ id: review!.id, status: "approved" });
    expect(
      (await listApprovedReviews(f.products[0]!.id))[0]?.verifiedPurchase,
    ).toBe(true);
  });
  it("prevents last-owner lockout even with concurrent owner deactivations", async () => {
    await expect(
      updateOperator({ id: ownerId, status: "inactive" }),
    ).rejects.toMatchObject({ code: "LAST_OWNER" });
    const [ownerRole] = await db
      .select()
      .from(s.roles)
      .where(eq(s.roles.isOwner, true));
    const second = await createOperator({
      name: "TEST OWNER TWO",
      email: "owner2@example.test",
      password: ownerPassword,
      roleId: ownerRole!.id,
    });
    authMock
      .mockReset()
      .mockResolvedValueOnce(identity(ownerId))
      .mockResolvedValueOnce(identity(second.id));
    const attempts = await Promise.allSettled([
      updateOperator({ id: ownerId, status: "inactive" }),
      updateOperator({ id: second.id, status: "inactive" }),
    ]);
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const remaining = await db
      .select({ id: s.users.id })
      .from(s.users)
      .innerJoin(s.roles, eq(s.users.roleId, s.roles.id))
      .where(and(eq(s.roles.isOwner, true), eq(s.users.status, "active")));
    expect(remaining).toHaveLength(1);
    ownerId = remaining[0]!.id;
  });
});
