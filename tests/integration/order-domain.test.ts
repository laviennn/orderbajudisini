import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { startTestDatabase } from "./database";
import { shippingContextFingerprint } from "@/server/shipping/context";
const testOrigin = {
  province: "TEST",
  city: "TEST",
  district: "TEST",
  subdistrict: null,
  postalCode: "00000",
  providerDestinationId: null,
};
import * as s from "@/server/db/schema";
let database: Awaited<ReturnType<typeof startTestDatabase>>;
// Only inject the connection: all service queries, transactions and locks hit real PostgreSQL.
vi.mock("@/server/db", () => ({ getDatabase: () => database.db }));
// Guest order creation/expiry must not invoke staff auth; avoid loading Next's HTTP runtime here.
vi.mock("@/server/auth", () => ({
  auth: () => {
    throw new Error("Unexpected staff authentication");
  },
  authenticationEnabled: () => false,
}));
import {
  createReservedOrder,
  cartFingerprint,
  hashToken,
  releaseExpiredReservations,
} from "@/server/services/orders";

beforeAll(async () => {
  database = await startTestDatabase();
  vi.stubEnv("SHIPPING_PROVIDER", "TEST");
  vi.stubEnv("AUTH_SECRET", "TEST-only-order-domain-secret-".repeat(2));
  await database.db.insert(s.storeSettings).values({
    id: 1,
    storeName: "TEST ONLY",
    shippingOrigin: testOrigin,
    reservationMinutes: 30,
  });
});
afterAll(async () => {
  await database?.stop();
  vi.unstubAllEnvs();
});
async function fixture(
  prices = [45000],
  eligibility = prices.map(() => true),
  quantity = 1,
) {
  const db = database.db;
  const suffix = randomUUID();
  const [category] = await db
    .insert(s.categories)
    .values({ name: "TEST", slug: `test-${suffix}` })
    .returning();
  const products = await db
    .insert(s.products)
    .values(
      prices.map((price, i) => ({
        sku: `TEST-${suffix}-${i}`,
        slug: `test-${suffix}-${i}`,
        name: `TEST item ${i}`,
        description: "TEST description",
        categoryId: category!.id,
        price,
        promotionEligible: eligibility[i],
        sizeLabel: "M",
        conditionGrade: "TEST good",
        conditionNotes: "TEST fading",
        defectNotes: "TEST pinhole",
        status: "active" as const,
        quantity,
        weightGrams: 100,
      })),
    )
    .returning();
  const [promotion] = await db
    .insert(s.promotions)
    .values({
      name: "TEST bundle",
      requiredQuantity: 3,
      bundlePrice: 100000,
      active: true,
      allocationStrategy: "highest_price_first",
      pricePolicy: "fixed_bundle",
      categoryId: category!.id,
    })
    .returning();
  const [customer] = await db
    .insert(s.customers)
    .values({ name: "TEST customer", phone: "0000000000" })
    .returning();
  const [address] = await db
    .insert(s.addresses)
    .values({
      customerId: customer!.id,
      recipientName: "TEST recipient",
      phone: "0000000000",
      addressLine: "TEST only",
      province: "TEST",
      city: "TEST",
      district: "TEST",
      postalCode: "00000",
    })
    .returning();
  const [bank] = await db
    .insert(s.bankAccounts)
    .values({
      bankName: "TEST",
      accountNumber: "00000000",
      accountHolder: "TEST ONLY",
      active: true,
    })
    .returning();
  // Retain the existing order contract. This trusted, isolated fixture is NOT a shipping integration/rate.
  const quoteValues = {
    contextFingerprint: shippingContextFingerprint(testOrigin, address!),
    customerId: customer!.id,
    addressId: address!.id,
    provider: "TEST",
    courier: "TEST",
    service: "TEST",
    cost: 10000,
    cartFingerprint: cartFingerprint(
      products.map((p) => ({
        productId: p.id,
        quantity: 1,
        weightGrams: p.weightGrams,
      })),
    ),
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
    bankAccountId: bank!.id,
    shippingQuoteId: quote!.id,
    items: products.map((p) => ({ productId: p.id, quantity: 1 })),
  };
  return {
    products,
    category: category!,
    promotion: promotion!,
    input,
    quoteValues,
  };
}
const readOrder = async (id: string) =>
  (await database.db.select().from(s.orders).where(eq(s.orders.id, id)))[0]!;
const readProduct = async (id: string) =>
  (
    await database.db.select().from(s.products).where(eq(s.products.id, id))
  )[0]!;

it.each([
  {
    name: "three eligible above 100k",
    prices: [45000, 45000, 45000],
    eligible: [true, true, true],
    total: 100000,
    bundles: 1,
  },
  {
    name: "three eligible below 100k",
    prices: [20000, 25000, 30000],
    eligible: [true, true, true],
    total: 75000,
    bundles: 0,
  },
  {
    name: "mixed eligible and ineligible",
    prices: [45000, 45000, 45000, 45000, 45000],
    eligible: [true, false, true, false, true],
    total: 190000,
    bundles: 1,
  },
  {
    name: "six eligible",
    prices: Array(6).fill(45000),
    eligible: Array(6).fill(true),
    total: 200000,
    bundles: 2,
  },
  {
    name: "eligible remainder",
    prices: Array(7).fill(45000),
    eligible: Array(7).fill(true),
    total: 245000,
    bundles: 2,
  },
])(
  "persists authoritative pricing: $name",
  async ({ prices, eligible, total, bundles }) => {
    const f = await fixture(prices, eligible);
    const result = await createReservedOrder(f.input);
    const order = await readOrder(result.id);
    const lines = await database.db
      .select()
      .from(s.orderItems)
      .where(eq(s.orderItems.orderId, result.id));
    const promos = await database.db
      .select()
      .from(s.orderPromotions)
      .where(eq(s.orderPromotions.orderId, result.id));
    expect(order).toMatchObject({
      status: "pending_payment",
      merchandiseTotal: total,
      surchargeTotal: 0,
    });
    expect(order.merchandiseTotal).toBe(order.subtotal - order.discountTotal);
    expect(lines.reduce((n, l) => n + l.lineTotal, 0)).toBe(total);
    if (bundles)
      expect(promos[0]).toMatchObject({
        bundleCount: bundles,
        pricePolicySnapshot: "discount_only",
        surchargeAmount: 0,
      });
    else expect(promos).toHaveLength(0);
    expect(result.orderNumber).toMatch(/^ORD-\d{8}-[A-F0-9]{12}$/);
    expect(result.publicToken).toMatch(/^[a-f0-9]{64}$/);
    expect(result.publicToken).not.toBe(result.id);
    expect(order.publicTokenHash).toBe(hashToken(result.publicToken));
    expect(order.publicTokenCiphertext).not.toContain(result.publicToken);
    expect(order.paymentDueAt.getTime()).toBeGreaterThan(Date.now());
  },
);
it("rejects client monetary/eligibility fields and reads current database values", async () => {
  const f = await fixture([45000, 45000, 45000]);
  for (const field of [
    "price",
    "subtotal",
    "discount",
    "promotionEligible",
    "merchandiseTotal",
    "grandTotal",
  ])
    await expect(
      createReservedOrder({ ...f.input, [field]: 1 }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await expect(
    createReservedOrder({
      ...f.input,
      items: f.input.items.map((i) => ({ ...i, price: 1 })),
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await database.db
    .update(s.products)
    .set({ price: 90000, promotionEligible: false })
    .where(eq(s.products.id, f.products[0]!.id));
  const result = await createReservedOrder(f.input);
  expect(await readOrder(result.id)).toMatchObject({
    subtotal: 180000,
    merchandiseTotal: 180000,
    discountTotal: 0,
  });
});
it("keeps item/promotion snapshots immutable after catalog changes", async () => {
  const f = await fixture([45000, 45000, 45000]);
  const imageKey = `product/${randomUUID()}.webp`;
  await database.db.insert(s.productImages).values({
    productId: f.products[0]!.id,
    objectKey: imageKey,
    altText: "TEST",
    width: 720,
    height: 960,
    bytes: 100,
    mimeType: "image/webp",
    variant: "card",
  });
  const result = await createReservedOrder(f.input);
  const before = await database.db
    .select()
    .from(s.orderItems)
    .where(eq(s.orderItems.orderId, result.id));
  const beforePromotion = await database.db
    .select()
    .from(s.orderPromotions)
    .where(eq(s.orderPromotions.orderId, result.id));
  expect(before.find((l) => l.productId === f.products[0]!.id)).toMatchObject({
    skuSnapshot: f.products[0]!.sku,
    slugSnapshot: f.products[0]!.slug,
    sizeSnapshot: "M",
    conditionSnapshot: "TEST good\nTEST fading\nTEST pinhole",
    imageSnapshot: imageKey,
    priceSnapshot: 45000,
    quantity: 1,
  });
  await database.db
    .update(s.products)
    .set({
      name: "TEST edited",
      price: 90000,
      sizeLabel: "XL",
      conditionNotes: "TEST changed",
    })
    .where(
      inArray(
        s.products.id,
        f.products.map((p) => p.id),
      ),
    );
  await database.db
    .update(s.promotions)
    .set({ name: "TEST changed", active: false })
    .where(eq(s.promotions.id, f.promotion.id));
  expect(
    await database.db
      .select()
      .from(s.orderItems)
      .where(eq(s.orderItems.orderId, result.id)),
  ).toEqual(before);
  expect(
    await database.db
      .select()
      .from(s.orderPromotions)
      .where(eq(s.orderPromotions.orderId, result.id)),
  ).toEqual(beforePromotion);
  await expect(
    database.db
      .update(s.orderItems)
      .set({ nameSnapshot: "tampered" })
      .where(eq(s.orderItems.orderId, result.id)),
  ).rejects.toThrow();
  await expect(
    database.db
      .update(s.orderPromotions)
      .set({ nameSnapshot: "tampered" })
      .where(eq(s.orderPromotions.orderId, result.id)),
  ).rejects.toThrow();
});
it("rolls back stock, snapshots, reservations, payment and history after a late SQL failure", async () => {
  const f = await fixture([45000, 45000, 45000]);
  const before = await Promise.all(
    [
      s.orders,
      s.orderItems,
      s.orderPromotions,
      s.reservations,
      s.payments,
      s.orderStatusHistory,
    ].map((table) => database.db.select().from(table)),
  );
  await database.pool.query(
    `CREATE FUNCTION test_order_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST rollback' USING ERRCODE='23514'; END; $$; CREATE TRIGGER test_order_failure BEFORE INSERT ON order_status_history FOR EACH ROW EXECUTE FUNCTION test_order_failure();`,
  );
  try {
    await expect(createReservedOrder(f.input)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    const after = await Promise.all(
      [
        s.orders,
        s.orderItems,
        s.orderPromotions,
        s.reservations,
        s.payments,
        s.orderStatusHistory,
      ].map((table) => database.db.select().from(table)),
    );
    expect(after.map((rows) => rows.length)).toEqual(
      before.map((rows) => rows.length),
    );
    for (const product of f.products)
      expect(await readProduct(product.id)).toMatchObject({
        status: "active",
        quantity: 1,
      });
  } finally {
    await database.pool.query(
      "DROP TRIGGER test_order_failure ON order_status_history; DROP FUNCTION test_order_failure();",
    );
  }
});
it("serializes simultaneous retries, preserves the random token, and rejects changed payloads", async () => {
  const f = await fixture([45000, 45000, 45000]);
  const reversed = {
    ...f.input,
    idempotencyKey: f.input.idempotencyKey.toUpperCase(),
    items: [...f.input.items]
      .reverse()
      .map((i) => ({ ...i, productId: i.productId.toUpperCase() })),
  };
  const [a, b] = await Promise.all([
    createReservedOrder(f.input),
    createReservedOrder(reversed),
  ]);
  expect(a).toEqual(b);
  expect(await createReservedOrder(f.input)).toEqual(a);
  expect(
    await database.db
      .select()
      .from(s.orders)
      .where(eq(s.orders.idempotencyKey, f.input.idempotencyKey)),
  ).toHaveLength(1);
  expect(
    await database.db
      .select()
      .from(s.reservations)
      .where(eq(s.reservations.orderId, a.id)),
  ).toHaveLength(3);
  await expect(
    createReservedOrder({ ...f.input, notes: "different" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
it("expires an unpaid order exactly once across simultaneous release attempts", async () => {
  const f = await fixture();
  const created = await createReservedOrder(f.input);
  await database.db
    .update(s.orders)
    .set({ paymentDueAt: new Date(0) })
    .where(eq(s.orders.id, created.id));
  const results = await Promise.all([
    releaseExpiredReservations(100),
    releaseExpiredReservations(100),
  ]);
  expect(results.reduce((sum, r) => sum + r.expired, 0)).toBe(1);
  expect((await releaseExpiredReservations(100)).expired).toBe(0);
  expect(await readOrder(created.id)).toMatchObject({ status: "expired" });
  expect(await readProduct(f.products[0]!.id)).toMatchObject({
    status: "active",
    quantity: 1,
  });
  expect(
    await database.db
      .select()
      .from(s.reservations)
      .where(eq(s.reservations.orderId, created.id)),
  ).toMatchObject([{ status: "released" }]);
  expect(
    await database.db
      .select()
      .from(s.orderStatusHistory)
      .where(
        and(
          eq(s.orderStatusHistory.orderId, created.id),
          eq(s.orderStatusHistory.toStatus, "expired"),
        ),
      ),
  ).toHaveLength(1);
  expect(await createReservedOrder(f.input)).toEqual(created);
  expect(await readProduct(f.products[0]!.id)).toMatchObject({
    status: "active",
    quantity: 1,
  });
});
it("allows exactly one of two overlapping PostgreSQL transactions to reserve quantity one", async () => {
  const f = await fixture();
  const [quote2] = await database.db
    .insert(s.shippingQuotes)
    .values(f.quoteValues)
    .returning();
  const blocker = await database.pool.connect();
  await blocker.query("BEGIN");
  await blocker.query("SELECT id FROM products WHERE id = $1 FOR UPDATE", [
    f.products[0]!.id,
  ]);
  const outcomes = Promise.allSettled([
    createReservedOrder(f.input),
    createReservedOrder({
      ...f.input,
      idempotencyKey: randomUUID(),
      shippingQuoteId: quote2!.id,
    }),
  ]);
  try {
    // Prove both real connections reached the row lock before allowing either to proceed.
    await expect
      .poll(
        async () => {
          const result = await database.pool.query<{ waiting: number }>(
            `SELECT count(*)::integer AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%from "products"%'`,
          );
          return result.rows[0]!.waiting;
        },
        { timeout: 5000, interval: 20 },
      )
      .toBe(2);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
  const results = await outcomes;
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const rejected = results.filter((r) => r.status === "rejected");
  expect(rejected).toHaveLength(1);
  expect(rejected[0]!.reason).toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
  const storedOrders = await database.db
    .select()
    .from(s.orders)
    .where(eq(s.orders.customerId, f.input.customerId));
  expect(storedOrders).toHaveLength(1);
  expect(storedOrders[0]).toMatchObject({
    status: "pending_payment",
    merchandiseTotal: 45000,
  });
  const holds = await database.db
    .select()
    .from(s.reservations)
    .where(eq(s.reservations.productId, f.products[0]!.id));
  expect(holds).toHaveLength(1);
  expect(holds[0]).toMatchObject({
    orderId: storedOrders[0]!.id,
    quantity: 1,
    status: "reserved",
  });
  expect(await readProduct(f.products[0]!.id)).toMatchObject({
    status: "reserved",
    quantity: 0,
  });
});
it.each(["draft", "archived", "sold", "reserved"] as const)(
  "rejects %s inventory",
  async (status) => {
    const f = await fixture();
    await database.db
      .update(s.products)
      .set({
        status,
        quantity: status === "sold" || status === "reserved" ? 0 : 1,
      })
      .where(eq(s.products.id, f.products[0]!.id));
    await expect(createReservedOrder(f.input)).rejects.toMatchObject({
      code: "PRODUCT_UNAVAILABLE",
    });
  },
);
it("rejects zero stock, inactive category, missing product and duplicated UUID casing", async () => {
  const f = await fixture();
  await expect(
    database.db
      .update(s.products)
      .set({ quantity: 0 })
      .where(eq(s.products.id, f.products[0]!.id)),
  ).rejects.toMatchObject({ cause: { code: "23514" } });
  await database.db
    .update(s.products)
    .set({ quantity: 0, status: "draft" })
    .where(eq(s.products.id, f.products[0]!.id));
  await expect(createReservedOrder(f.input)).rejects.toMatchObject({
    code: "PRODUCT_UNAVAILABLE",
  });
  await database.db
    .update(s.products)
    .set({ quantity: 1, status: "active" })
    .where(eq(s.products.id, f.products[0]!.id));
  await database.db
    .update(s.categories)
    .set({ active: false })
    .where(eq(s.categories.id, f.category.id));
  await expect(createReservedOrder(f.input)).rejects.toMatchObject({
    code: "PRODUCT_UNAVAILABLE",
  });
  await expect(
    createReservedOrder({
      ...f.input,
      items: [{ productId: randomUUID(), quantity: 1 }],
    }),
  ).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
  await expect(
    createReservedOrder({
      ...f.input,
      items: [
        f.input.items[0],
        {
          ...f.input.items[0],
          productId: f.input.items[0]!.productId.toUpperCase(),
        },
      ],
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
});
it("rejects new surcharges at the SQL boundary without weakening immutable snapshots", async () => {
  const f = await fixture();
  const created = await createReservedOrder(f.input);
  const order = await readOrder(created.id);
  await expect(
    database.db.insert(s.orders).values({
      ...order,
      id: randomUUID(),
      orderNumber: `TEST-${randomUUID()}`,
      idempotencyKey: randomUUID(),
      publicTokenHash: hashToken(randomUUID()),
      shippingQuoteId: randomUUID(),
      surchargeTotal: 1,
      merchandiseTotal: order.merchandiseTotal + 1,
      grandTotal: order.grandTotal + 1,
    }),
  ).rejects.toMatchObject({ cause: { code: "23514" } });
});
