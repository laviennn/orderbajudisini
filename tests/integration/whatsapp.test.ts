import { randomUUID } from "node:crypto";
import { expect, test, beforeAll, vi } from "vitest";
import { startTestDatabase } from "./database";
import * as s from "@/server/db/schema";
import { AppError } from "@/lib/errors";

let database: Awaited<ReturnType<typeof startTestDatabase>>;

vi.mock("@/server/db", () => ({ getDatabase: () => database.db }));
vi.mock("@/server/auth", () => ({
  auth: () => {
    throw new Error("Unexpected staff authentication");
  },
  authenticationEnabled: () => false,
}));

import type { StorageAdapter } from "@/server/storage/r2";
const objects = new Map<string, { body: Buffer; mime: string }>();

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
        name: `TEST Product ${i}`,
        description: "Test Description",
        conditionGrade: "like_new" as const,
        conditionNotes: "Test Notes",
        categoryId: category!.id,
        price,
        weightGrams: 200,
        status: "active" as const,
        quantity: 1,
        promotionEligible: true,
        publishedAt: new Date(),
      }))
    )
    .returning();
  return { category, products };
}
const adapter: StorageAdapter = {
  createUpload: async (input) => ({
    key: `payment-proof/${randomUUID()}.webp`,
    url: "https://test.invalid/upload",
    expiresIn: 120,
    headers: { "Content-Type": input.mime },
  }),
  inspectObject: async (purpose, key) => {
    const value = objects.get(key);
    if (!value) throw new AppError("NOT_FOUND");
    return { bytes: value.body.length, mime: value.mime };
  },
  readProductSource: async (key) => objects.get(key)!.body,
  readPaymentProof: async (key) => objects.get(key)!.body,
  writeProductVariant: async (key, body) => {
    objects.set(key, { body, mime: "image/webp" });
  },
  deleteObject: async (purpose, key) => {
    objects.delete(key);
  },
  privateProofUrl: async (key) => ({
    url: `https://test.invalid/proof/${key}`,
    expiresIn: 120,
  }),
  publicMediaUrl: (key) => `https://test.invalid/${key}`,
};
vi.mock("@/server/storage/r2", () => ({
  getStorage: () => adapter,
}));

import { generateWhatsAppConfirmationUrl } from "@/server/services/whatsapp";
import { eq } from "drizzle-orm";
import { prepareCheckout, submitCheckout } from "@/server/services/checkout";
import { authorizeProofUpload, completeProofUpload } from "@/server/services/payments";

beforeAll(async () => {
  database = await startTestDatabase();
  vi.stubEnv("AUTH_SECRET", "TEST-only-checkout-secret-".repeat(2));
  vi.stubEnv("SHIPPING_PROVIDER", "test");
  vi.stubEnv("APP_URL", "https://localhost:3000");
  
  // Set store settings
  await database.db
    .insert(s.storeSettings)
    .values({ id: 1, storeName: "Test Store", whatsappNumber: "081234567890", reservationMinutes: 30, shippingOrigin: { province: "TEST", city: "TEST", district: "TEST", subdistrict: null, postalCode: "00000", providerDestinationId: null } })
    .onConflictDoUpdate({
      target: s.storeSettings.id,
      set: { whatsappNumber: "081234567890" },
    });
    
  await database.db
    .insert(s.bankAccounts)
    .values({
      bankName: "TEST BANK",
      accountNumber: "1234567890",
      accountHolder: "TEST HOLDER",
      active: true,
      sortOrder: 1,
    });
});

test("rejects invalid public token", async () => {
  await expect(generateWhatsAppConfirmationUrl("invalid-token")).rejects.toThrow("Data tidak ditemukan.");
});

test("handles whatsapp configuration safely and correctly formats message", async () => {
  const { products } = await fixture([45000]);
  const origin = { province: "TEST", city: "TEST", district: "TEST", subdistrict: "TEST", postalCode: "12345" };
  let req: Awaited<ReturnType<typeof prepareCheckout>>;
  try {
    req = await prepareCheckout({
      ids: [products[0]!.id],
      customer: {
        name: "Pembeli WA",
        phone: "081234567890",
        email: "wa@example.invalid",
        recipientName: "Pembeli WA",
        addressLine: "Jalan WA No 1",
        ...origin,
      }
    });
  } catch (err) {
    if (err instanceof AppError) console.error(err.fieldErrors);
    throw err;
  }

  const { publicToken } = await submitCheckout({
    reference: req.choices[0]!.reference,
  });

  // Should reject if not payment_submitted
  await expect(generateWhatsAppConfirmationUrl(publicToken)).rejects.toThrow("Periksa kembali data yang dikirim.");

  const auth = await authorizeProofUpload(publicToken, {
    mime: "image/jpeg",
    bytes: 1000,
  });

  const buffer = Buffer.alloc(1000);
  buffer.set([0xFF, 0xD8, 0xFF, 0xE0], 0);
  objects.set(auth.key, { body: buffer, mime: "image/jpeg" });

  await completeProofUpload(publicToken, {
    key: auth.key,
    signature: auth.signature,
  });

  const url = await generateWhatsAppConfirmationUrl(publicToken);
  expect(url).toContain("https://wa.me/6281234567890?text=");

  const searchParams = new URL(url).searchParams;
  const text = searchParams.get("text")!;
  expect(text).toContain("Halo Admin, saya ingin mengonfirmasi pembayaran pesanan saya.");
  expect(text).toContain("Nama Pembeli: Pembeli WA");
  expect(text).toContain("Alamat: Jalan WA No 1, TEST, TEST, TEST, 12345");
  expect(text).toContain("https://localhost:3000/proof/"); // APP_URL in test env

  // Test no whatsapp number
  await database.db.update(s.storeSettings).set({ whatsappNumber: null }).where(eq(s.storeSettings.id, 1));
  await expect(generateWhatsAppConfirmationUrl(publicToken)).rejects.toThrow("Periksa kembali data yang dikirim.");

  // Restore whatsapp number
  await database.db.update(s.storeSettings).set({ whatsappNumber: "081234567890" }).where(eq(s.storeSettings.id, 1));
});
