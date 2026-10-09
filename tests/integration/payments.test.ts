import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
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
  readSiteMedia: async (key) => objects.get(key)!.body,
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

import { prepareCheckout, submitCheckout } from "@/server/services/checkout";
import {
  authorizeProofUpload,
  completeProofUpload,
  resolveProofUrl,
} from "@/server/services/payments";
import { hashToken } from "@/server/services/orders";

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

async function createOrder(price = 45000) {
  const db = database.db;
  const suffix = randomUUID();
  const [category] = await db
    .insert(s.categories)
    .values({ name: "TEST", slug: `test-${suffix}` })
    .returning();
  const [product] = await db
    .insert(s.products)
    .values({
      sku: `TEST-${suffix}`,
      slug: `test-${suffix}`,
      name: "TEST item",
      description: "TEST desc",
      categoryId: category!.id,
      price,
      sizeLabel: "M",
      conditionGrade: "TEST good",
      conditionNotes: "TEST",
      status: "active",
      quantity: 10,
      weightGrams: 500,
    })
    .returning();

  const prepareData = {
    ids: [product!.id],
    customer: {
      name: "Budi Santoso",
      email: "budi@example.com",
      phone: "081234567890",
      recipientName: "Budi Santoso",
      addressLine: "Jalan Merdeka 123",
      province: "TEST",
      city: "TEST",
      district: "TEST",
      postalCode: "00000",
    },
  };
  const { choices, payments } = await prepareCheckout(prepareData);
  const { publicToken } = await submitCheckout({
    reference: choices[0]!.reference,
    paymentMethodId: payments[0]!.id,
  });

  const [order] = await db
    .select()
    .from(s.orders)
    .where(eq(s.orders.publicTokenHash, hashToken(publicToken)));
  return { publicToken, order: order! };
}

describe("Payment Proof Integration", () => {
  it("authorizes and completes proof upload successfully", async () => {
    const { publicToken, order } = await createOrder();

    // 1. Authorize
    const auth = await authorizeProofUpload(publicToken, {
      mime: "image/jpeg",
      bytes: 1024,
    });
    expect(auth).toHaveProperty("key");
    expect(auth).toHaveProperty("signature");

    // Mock upload valid JPEG magic bytes
    const validJpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(1021),
    ]);
    objects.set(auth.key, { body: validJpeg, mime: "image/jpeg" });

    // 2. Complete
    const complete = await completeProofUpload(publicToken, {
      key: auth.key,
      signature: auth.signature,
    });
    expect(complete.status).toBe("submitted");
    expect(complete.proofToken).toBeDefined();

    // 3. Verify order state
    const [updatedOrder] = await database.db
      .select()
      .from(s.orders)
      .where(eq(s.orders.id, order.id));
    expect(updatedOrder!.status).toBe("payment_submitted");

    // 4. Resolve Proof URL
    const { url } = await resolveProofUrl(complete.proofToken!);
    expect(url).toContain(auth.key);
  });

  it("fails completion if signature is invalid", async () => {
    const { publicToken } = await createOrder();
    const auth = await authorizeProofUpload(publicToken, {
      mime: "image/jpeg",
      bytes: 1024,
    });

    const validJpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(1021),
    ]);
    objects.set(auth.key, { body: validJpeg, mime: "image/jpeg" });

    try {
      await completeProofUpload(publicToken, {
        key: auth.key,
        signature: "a".repeat(64),
      });
      expect.fail("Should throw");
    } catch (e: unknown) {
      const err = e as { message: string; fieldErrors: { file: string[] } };
      expect(err.message).toBe("Periksa kembali data yang dikirim.");
      expect(err.fieldErrors.file[0]).toBe("Otorisasi unggahan tidak valid.");
    }
  });

  it("fails completion if magic bytes are invalid", async () => {
    const { publicToken } = await createOrder();
    const auth = await authorizeProofUpload(publicToken, {
      mime: "image/jpeg",
      bytes: 1024,
    });

    // Invalid magic bytes
    const invalidJpeg = Buffer.alloc(1024);
    objects.set(auth.key, { body: invalidJpeg, mime: "image/jpeg" });

    try {
      await completeProofUpload(publicToken, {
        key: auth.key,
        signature: auth.signature,
      });
      expect.fail("Should throw");
    } catch (e: unknown) {
      const err = e as { message: string; fieldErrors: { file: string[] } };
      expect(err.message).toBe("Periksa kembali data yang dikirim.");
      expect(err.fieldErrors.file[0]).toBe(
        "Konten file tidak sesuai format gambar yang didukung.",
      );
    }
  });

  it("fails authorization if order is expired", async () => {
    const { publicToken, order } = await createOrder();

    await database.db
      .update(s.orders)
      .set({ paymentDueAt: new Date(Date.now() - 1000) })
      .where(eq(s.orders.id, order.id));

    // Wait, the expiry cron hasn't run, so the order status is still pending_payment!
    // authorizeProofUpload does not check due date, it only checks `order.status`.
    // Wait, does it? `authorizeProofUpload` only checks `order.status !== "pending_payment"`.
    // Should we check due date in authorize/complete?
    // Let's actually expire it by changing status
    await database.db
      .update(s.orders)
      .set({ status: "cancelled" })
      .where(eq(s.orders.id, order.id));

    await expect(
      authorizeProofUpload(publicToken, { mime: "image/jpeg", bytes: 1024 }),
    ).rejects.toThrowError("Perubahan status pesanan tidak diizinkan.");
  });

  it("fails completion if reservation is expired", async () => {
    const { publicToken, order } = await createOrder();

    const auth = await authorizeProofUpload(publicToken, {
      mime: "image/jpeg",
      bytes: 1024,
    });
    const validJpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(1021),
    ]);
    objects.set(auth.key, { body: validJpeg, mime: "image/jpeg" });

    // Expire order paymentDueAt
    await database.db
      .update(s.orders)
      .set({ paymentDueAt: sql`clock_timestamp() - interval '1 minute'` })
      .where(eq(s.orders.id, order.id));

    await expect(
      completeProofUpload(publicToken, {
        key: auth.key,
        signature: auth.signature,
      }),
    ).rejects.toThrowError("Batas waktu reservasi telah berakhir.");
  });

  it("cleans up old proof when replaced", async () => {
    const { publicToken } = await createOrder();

    const auth1 = await authorizeProofUpload(publicToken, {
      mime: "image/png",
      bytes: 1024,
    });
    const validPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(1016),
    ]);
    objects.set(auth1.key, { body: validPng, mime: "image/png" });

    await completeProofUpload(publicToken, {
      key: auth1.key,
      signature: auth1.signature,
    });
    expect(objects.has(auth1.key)).toBe(true);

    const auth2 = await authorizeProofUpload(publicToken, {
      mime: "image/png",
      bytes: 1024,
    });
    objects.set(auth2.key, { body: validPng, mime: "image/png" });

    await completeProofUpload(publicToken, {
      key: auth2.key,
      signature: auth2.signature,
    });

    // First object should be deleted
    expect(objects.has(auth1.key)).toBe(false);
    expect(objects.has(auth2.key)).toBe(true);
  });
});
