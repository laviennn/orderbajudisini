import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
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
import { createReservedOrder, cartFingerprint } from "@/server/services/orders";

beforeAll(async () => {
  database = await startTestDatabase();
  vi.stubEnv("SHIPPING_PROVIDER", "test");
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

import { createShippingQuotes } from "@/server/services/shipping-quotes";
import { getShippingProvider } from "@/server/shipping/provider";
async function quoted() {
  const f = await fixture();
  const request = {
    customerId: f.input.customerId,
    addressId: f.input.addressId,
    items: f.input.items,
  };
  const [quote] = await createShippingQuotes(request);
  return {
    ...f,
    request,
    quote: quote!,
    input: { ...f.input, shippingQuoteId: quote!.quoteId },
  };
}
it("persists normalized rates and uses only the server-stored cost in orders", async () => {
  const f = await quoted();
  expect(f.quote).toMatchObject({
    provider: "test",
    courierCode: "TEST",
    cost: 10000,
    testOnly: true,
  });
  expect(f.quote.expiresAt.getTime() - Date.now()).toBeGreaterThan(280000);
  expect(f.quote.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(300000);
  await expect(
    createShippingQuotes({ ...f.request, cost: 1 }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await expect(
    createReservedOrder({ ...f.input, shippingCost: 1 }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await createReservedOrder(f.input);
  const [order] = await database.db
    .select()
    .from(s.orders)
    .where(eq(s.orders.shippingQuoteId, f.quote.quoteId));
  expect(order!.shippingCost).toBe(10000);
});
it("rejects expired, unknown and another customer's references", async () => {
  const f = await quoted();
  await expect(
    createReservedOrder({ ...f.input, shippingQuoteId: randomUUID() }),
  ).rejects.toMatchObject({ code: "INVALID_SHIPPING_SELECTION" });
  const other = await quoted();
  await expect(
    createReservedOrder({ ...f.input, shippingQuoteId: other.quote.quoteId }),
  ).rejects.toMatchObject({ code: "INVALID_SHIPPING_SELECTION" });
  await database.db
    .update(s.shippingQuotes)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(s.shippingQuotes.id, f.quote.quoteId));
  await expect(createReservedOrder(f.input)).rejects.toMatchObject({
    code: "SHIPPING_QUOTE_EXPIRED",
  });
});
it.each(["address", "weight", "origin"])(
  "invalidates quotes after %s changes",
  async (change) => {
    const f = await quoted();
    if (change === "address")
      await database.db
        .update(s.addresses)
        .set({ addressLine: "TEST changed" })
        .where(eq(s.addresses.id, f.input.addressId));
    if (change === "weight")
      await database.db
        .update(s.products)
        .set({ weightGrams: 200 })
        .where(eq(s.products.id, f.products[0]!.id));
    if (change === "origin")
      await database.db
        .update(s.storeSettings)
        .set({ shippingOrigin: { ...testOrigin, district: "TEST changed" } })
        .where(eq(s.storeSettings.id, 1));
    try {
      await expect(createReservedOrder(f.input)).rejects.toMatchObject({
        code: "INVALID_SHIPPING_SELECTION",
      });
    } finally {
      await database.db
        .update(s.storeSettings)
        .set({ shippingOrigin: testOrigin })
        .where(eq(s.storeSettings.id, 1));
    }
  },
);
it("validates missing weight, origin and invalid destination before provider IO", async () => {
  const f = await quoted();
  const quote = vi.fn(getShippingProvider().quote);
  const provider = { ...getShippingProvider(), quote };
  await database.db
    .update(s.products)
    .set({ weightGrams: null })
    .where(eq(s.products.id, f.products[0]!.id));
  await expect(createShippingQuotes(f.request, provider)).rejects.toMatchObject(
    { code: "SHIPPING_WEIGHT_INVALID" },
  );
  await database.db
    .update(s.products)
    .set({ weightGrams: 100 })
    .where(eq(s.products.id, f.products[0]!.id));
  await expect(
    createShippingQuotes({ ...f.request, addressId: randomUUID() }, provider),
  ).rejects.toMatchObject({ code: "INVALID_DESTINATION" });
  await database.db
    .update(s.storeSettings)
    .set({ shippingOrigin: null })
    .where(eq(s.storeSettings.id, 1));
  try {
    await expect(
      createShippingQuotes(f.request, provider),
    ).rejects.toMatchObject({ code: "SHIPPING_ORIGIN_INVALID" });
  } finally {
    await database.db
      .update(s.storeSettings)
      .set({ shippingOrigin: testOrigin })
      .where(eq(s.storeSettings.id, 1));
  }
  expect(quote).not.toHaveBeenCalled();
});
it("rechecks context after provider IO without holding database locks", async () => {
  const f = await quoted();
  const base = getShippingProvider();
  await expect(
    createShippingQuotes(f.request, {
      ...base,
      async quote(input, signal) {
        await database.db
          .update(s.products)
          .set({ weightGrams: 300 })
          .where(eq(s.products.id, f.products[0]!.id));
        return base.quote(input, signal);
      },
    }),
  ).rejects.toMatchObject({ code: "INVALID_SHIPPING_SELECTION" });
});
it("rejects persisted test references in production", async () => {
  const f = await quoted();
  vi.stubEnv("NODE_ENV", "production");
  try {
    await expect(createReservedOrder(f.input)).rejects.toMatchObject({
      code: "SHIPPING_NOT_CONFIGURED",
    });
  } finally {
    vi.stubEnv("NODE_ENV", "test");
  }
});
