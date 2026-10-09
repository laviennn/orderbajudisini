import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { startTestDatabase } from "./database";

import * as s from "@/server/db/schema";
let database: Awaited<ReturnType<typeof startTestDatabase>>;

vi.mock("@/server/db", () => ({ getDatabase: () => database.db }));
vi.mock("@/server/auth", () => ({
  auth: () => {
    throw new Error("Unexpected staff authentication");
  },
  authenticationEnabled: () => false,
}));

import {
  prepareCheckout,
  submitCheckout,
  publicOrder,
} from "@/server/services/checkout";

beforeAll(async () => {
  database = await startTestDatabase();
  vi.stubEnv("SHIPPING_PROVIDER", "test");
  vi.stubEnv("AUTH_SECRET", "TEST-only-checkout-secret-".repeat(2));

  const testOrigin = {
    province: "TEST",
    city: "TEST",
    district: "TEST",
    subdistrict: null,
    postalCode: "00000",
    providerDestinationId: null,
  };

  await database.db.insert(s.storeSettings).values({
    id: 1,
    storeName: "TEST ONLY",
    shippingOrigin: testOrigin,
    reservationMinutes: 30,
  });

  await database.db.insert(s.bankAccounts).values({
    bankName: "TEST BANK",
    accountNumber: "1234567890",
    accountHolder: "TEST HOLDER",
    active: true,
    sortOrder: 1,
  });
});

afterAll(async () => {
  await database?.stop();
  vi.unstubAllEnvs();
});

async function fixture(prices = [45000]) {
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
        sizeLabel: "M",
        conditionGrade: "TEST good",
        conditionNotes: "TEST fading",
        defectNotes: "TEST pinhole",
        status: "active" as const,
        quantity: 10,
        weightGrams: 500,
      })),
    )
    .returning();
  return { products };
}

describe("Checkout Flow Integration", () => {
  it("processes a full checkout flow end-to-end", async () => {
    const { products } = await fixture([45000]);

    // 1. Prepare Checkout
    const prepareData = {
      ids: [products[0]!.id],
      customer: {
        name: "Budi Santoso",
        email: "budi@example.com",
        phone: "081234567890",
        recipientName: "Budi Santoso",
        addressLine: "Jalan Merdeka 123",
        province: "Jawa Tengah",
        city: "Semarang",
        district: "Semarang Tengah",
        subdistrict: "Pendrikan Kidul",
        postalCode: "50131",
        notes: "Tolong bungkus rapi",
      },
    };

    const preview = await prepareCheckout(prepareData);

    expect(preview.cart.items).toHaveLength(1);
    expect(preview.choices.length).toBeGreaterThan(0);

    const choice = preview.choices[0]!;
    expect(choice.courier).toBeDefined();
    expect(choice.service).toBeDefined();
    expect(choice.cost).toBeGreaterThan(0);
    expect(choice.reference).toMatch(/^[A-Za-z0-9_-]+$/);

    // 2. Submit Checkout
    const paymentMethodId = preview.payments[0]!.id;
    const result = await submitCheckout({
      reference: choice.reference,
      paymentMethodId,
    });
    expect(result.publicToken).toMatch(/^[a-f0-9]{64}$/);

    // 3. View Public Order
    const order = await publicOrder(result.publicToken);
    expect(order).not.toBeNull();
    expect(order!.status).toBe("pending_payment");
    expect(order!.items).toHaveLength(1);
    expect(order!.items[0]!.name).toBe(products[0]!.name);

    // Check shipping details
    expect(order!.shippingDetails.provider).toBe("test");
    expect(order!.shippingDetails.courier).toBe("TEST");
    expect(order!.shippingDetails.service).toBe("TEST-STANDARD");

    // Check address snippet
    expect(order!.address.recipientName).toBe("Budi Santoso");
    expect(order!.address.phone).toBe("+6281234567890");

    // Verify records in database directly
    const db = database.db;
    const [dbOrder] = await db
      .select()
      .from(s.orders)
      .where(eq(s.orders.orderNumber, order!.orderNumber));
    expect(dbOrder!.notes).toBe("Tolong bungkus rapi");
    expect(dbOrder!.shippingCost).toBe(choice.cost);

    const [dbCustomer] = await db
      .select()
      .from(s.customers)
      .where(eq(s.customers.id, dbOrder!.customerId));
    expect(dbCustomer!.email).toBe("budi@example.com");
  });

  it("handles idempotent duplicate submissions gracefully", async () => {
    const { products } = await fixture([45000]);

    const preview = await prepareCheckout({
      ids: [products[0]!.id],
      customer: {
        name: "Ali",
        phone: "081234567891",
        recipientName: "Ali",
        addressLine: "Jalan Jalan",
        province: "Jawa",
        city: "Barat",
        district: "Satu",
        postalCode: "12345",
      },
    });

    const choice = preview.choices[0]!;

    const paymentMethodId = preview.payments[0]!.id;
    const res1 = await submitCheckout({
      reference: choice.reference,
      paymentMethodId,
    });
    const res2 = await submitCheckout({
      reference: choice.reference,
      paymentMethodId,
    });

    // Should yield exactly the same token
    expect(res1.publicToken).toBe(res2.publicToken);
  });
});
