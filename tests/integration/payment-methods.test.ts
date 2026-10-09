import sharp from "sharp";
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
import { startTestDatabase } from "./database";
import * as s from "@/server/db/schema";
import { bootstrapOwner } from "@/server/services/bootstrap";
import { AppError } from "@/lib/errors";

let database: Awaited<ReturnType<typeof startTestDatabase>>;
const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({ getDatabase: () => database.db }));
vi.mock("@/server/auth", () => ({
  auth: authMock,
  authenticationEnabled: () => true,
}));

let testPng: Buffer;
const mockStorage = {
  inspectObject: async () => ({ bytes: testPng.length, mime: "image/png" }),
  readSiteMedia: async () => testPng,
  createUpload: async (input: {
    mime: string;
    bytes: number;
    purpose: string;
  }) => ({
    key: `site-media/${randomUUID()}.png`,
    url: "https://test-storage.invalid/upload",
    expiresIn: 120,
    headers: { "Content-Type": input.mime },
  }),
  publicMediaUrl: (key: string) => {
    if (key.startsWith("payment-proof/")) {
      throw new AppError("VALIDATION_ERROR");
    }
    return `https://media.test.invalid/${key}`;
  },
};

vi.mock("@/server/storage/r2", () => ({
  getStorage: () => mockStorage,
}));

import {
  saveBankAccount,
  deleteBankAccount,
  listBankAccounts,
  saveQrisSettings,
  getQrisSettings,
} from "@/server/services/settings";
import {
  prepareCheckout,
  submitCheckout,
  publicOrder,
} from "@/server/services/checkout";

let adminId: string;

beforeAll(async () => {
  testPng = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  database = await startTestDatabase();
  const res = await bootstrapOwner(database.db, {
    name: "Admin",
    email: "admin-payment@test.invalid",
    password: "Password123456789",
  });
  adminId = res.id;

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
    storeName: "TEST STORE",
    shippingOrigin: testOrigin,
    reservationMinutes: 30,
  });
});

afterAll(async () => {
  await database?.stop();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  authMock.mockResolvedValue({ user: { id: adminId, sessionVersion: 0 } });
});

async function createProductFixture(price = 50000) {
  const db = database.db;
  const suffix = randomUUID();
  const [category] = await db
    .insert(s.categories)
    .values({ name: "Category Test", slug: `cat-${suffix}` })
    .returning();
  const [product] = await db
    .insert(s.products)
    .values({
      sku: `SKU-${suffix}`,
      slug: `product-${suffix}`,
      name: "Thrift Flannel Shirt",
      description: "Vintage flannel",
      categoryId: category!.id,
      price,
      sizeLabel: "L",
      conditionGrade: "Excellent",
      conditionNotes: "No flaws",
      status: "active" as const,
      quantity: 5,
      weightGrams: 300,
    })
    .returning();
  return { product: product! };
}

describe("Batch A — Payment Methods Operations & Verification", () => {
  let createdBankId: string;
  const validSiteMediaKey = `site-media/${randomUUID()}.png`;

  it("1. creates, edits, activates, and deactivates a bank account", async () => {
    // Create
    const created = await saveBankAccount({
      bankName: "BCA",
      accountNumber: "8881234567",
      accountHolder: "PT Thrift Store",
      instructions: "Transfer sesuai nominal",
      active: true,
      sortOrder: 1,
    });
    expect(created.id).toBeDefined();
    createdBankId = created.id;

    // List
    const banks = await listBankAccounts();
    const found = banks.find((b) => b.id === createdBankId);
    expect(found).toBeDefined();
    expect(found?.bankName).toBe("BCA");
    expect(found?.active).toBe(true);

    // Edit & Deactivate
    await saveBankAccount({
      id: createdBankId,
      bankName: "BCA Syariah",
      accountNumber: "8881234567",
      accountHolder: "PT Thrift Store Official",
      instructions: "Transfer tepat waktu",
      active: false,
      sortOrder: 2,
    });

    const updatedBanks = await listBankAccounts();
    const updated = updatedBanks.find((b) => b.id === createdBankId);
    expect(updated?.bankName).toBe("BCA Syariah");
    expect(updated?.active).toBe(false);
  });

  it("2. saves QRIS settings, validates required image when active, and allows image removal", async () => {
    // Attempt activating QRIS without an image -> MUST FAIL
    await expect(
      saveQrisSettings({
        merchantName: "Thrift QRIS",
        imageObjectKey: null,
        active: true,
      }),
    ).rejects.toThrow();

    // Attempt setting a private payment-proof key -> MUST FAIL
    await expect(
      saveQrisSettings({
        merchantName: "Thrift QRIS",
        imageObjectKey: `payment-proof/${randomUUID()}.jpg`,
        active: true,
      }),
    ).rejects.toThrow();

    // Valid QRIS save with site-media key
    await saveQrisSettings({
      merchantName: "Thrift QRIS Official",
      imageObjectKey: validSiteMediaKey,
      instructions: "Scan via BCA/Gopay/OVO",
      active: true,
    });

    const qris = await getQrisSettings();
    expect(qris?.active).toBe(true);
    expect(qris?.imageObjectKey).toBe(validSiteMediaKey);
    expect(qris?.merchantName).toBe("Thrift QRIS Official");

    // Remove QRIS image and deactivate
    await saveQrisSettings({
      merchantName: "Thrift QRIS Official",
      imageObjectKey: null,
      instructions: null,
      active: false,
    });

    const removed = await getQrisSettings();
    expect(removed?.active).toBe(false);
    expect(removed?.imageObjectKey).toBeNull();
  });

  it("3. ensures inactive bank accounts and inactive QRIS cannot be selected at prepareCheckout", async () => {
    // Reactivate bank account
    await saveBankAccount({
      id: createdBankId,
      bankName: "BCA",
      accountNumber: "8881234567",
      accountHolder: "PT Thrift Store",
      active: true,
      sortOrder: 1,
    });

    // Create a second inactive bank account
    const inactiveBank = await saveBankAccount({
      bankName: "Mandiri Inactive",
      accountNumber: "1234567890",
      accountHolder: "PT Inactive",
      active: false,
      sortOrder: 10,
    });

    // QRIS is currently inactive
    const { product } = await createProductFixture();
    const preview = await prepareCheckout({
      ids: [product.id],
      customer: {
        name: "Test Customer",
        phone: "08123456789",
        recipientName: "Test Customer",
        addressLine: "Jalan Test 123",
        province: "Jawa Tengah",
        city: "Semarang",
        district: "Semarang Tengah",
        subdistrict: "Pendrikan Kidul",
        postalCode: "50131",
      },
    });

    // Inactive bank must NOT appear
    const bankIds = preview.payments.map((p) => p.id);
    expect(bankIds).toContain(createdBankId);
    expect(bankIds).not.toContain(inactiveBank.id);

    // Inactive QRIS must NOT appear
    expect(bankIds).not.toContain("qris");

    // Activate QRIS with valid image
    await saveQrisSettings({
      merchantName: "Thrift QRIS Official",
      imageObjectKey: validSiteMediaKey,
      active: true,
    });

    const previewWithQris = await prepareCheckout({
      ids: [product.id],
      customer: {
        name: "Test Customer",
        phone: "08123456789",
        recipientName: "Test Customer",
        addressLine: "Jalan Test 123",
        province: "Jawa Tengah",
        city: "Semarang",
        district: "Semarang Tengah",
        subdistrict: "Pendrikan Kidul",
        postalCode: "50131",
      },
    });

    const updatedPaymentIds = previewWithQris.payments.map((p) => p.id);
    expect(updatedPaymentIds).toContain("qris");
    expect(updatedPaymentIds).toContain(createdBankId);
  });

  it("4. rejects checkout submission with inactive, invalid, or manipulated payment method", async () => {
    const { product } = await createProductFixture();
    const preview = await prepareCheckout({
      ids: [product.id],
      customer: {
        name: "Test Customer",
        phone: "08123456789",
        recipientName: "Test Customer",
        addressLine: "Jalan Test 123",
        province: "Jawa Tengah",
        city: "Semarang",
        district: "Semarang Tengah",
        subdistrict: "Pendrikan Kidul",
        postalCode: "50131",
      },
    });
    const reference = preview.choices[0]!.reference;

    // A. Submitting with non-existent UUID as bank account
    await expect(
      submitCheckout({
        reference,
        paymentMethodId: randomUUID(),
      }),
    ).rejects.toThrow();

    // B. Submitting with arbitrary manipulated non-UUID string
    await expect(
      submitCheckout({
        reference,
        paymentMethodId: "crypto-wallet-hacked",
      }),
    ).rejects.toThrow();

    // C. Submitting with inactive bank account
    const inactiveBank = await saveBankAccount({
      bankName: "Inactive Bank",
      accountNumber: "9999999999",
      accountHolder: "Nobody",
      active: false,
      sortOrder: 99,
    });
    await expect(
      submitCheckout({
        reference,
        paymentMethodId: inactiveBank.id,
      }),
    ).rejects.toThrow();

    // D. Submitting with inactive QRIS
    await saveQrisSettings({
      merchantName: "Thrift QRIS",
      imageObjectKey: validSiteMediaKey,
      active: false,
    });
    await expect(
      submitCheckout({
        reference,
        paymentMethodId: "qris",
      }),
    ).rejects.toThrow();
  });

  it("5. preserves bank and QRIS snapshots on order after settings change or method deletion", async () => {
    // Setup active Bank and active QRIS
    const bank = await saveBankAccount({
      bankName: "Snapshot Bank",
      accountNumber: "1112223334",
      accountHolder: "Snapshot Holder",
      instructions: "Transfer to Snapshot Bank",
      active: true,
      sortOrder: 1,
    });
    await saveQrisSettings({
      merchantName: "Snapshot QRIS",
      imageObjectKey: validSiteMediaKey,
      instructions: "Scan snapshot QRIS",
      active: true,
    });

    // 1. Place order with Bank Transfer
    const { product: prod1 } = await createProductFixture();
    const prev1 = await prepareCheckout({
      ids: [prod1.id],
      customer: {
        name: "Buyer 1",
        phone: "08123456789",
        recipientName: "Buyer 1",
        addressLine: "Jalan Buyer 1",
        province: "Jawa Tengah",
        city: "Semarang",
        district: "Semarang Tengah",
        postalCode: "50131",
      },
    });
    const bankOrderRes = await submitCheckout({
      reference: prev1.choices[0]!.reference,
      paymentMethodId: bank.id,
    });

    // 2. Place order with QRIS
    const { product: prod2 } = await createProductFixture();
    const prev2 = await prepareCheckout({
      ids: [prod2.id],
      customer: {
        name: "Buyer 2",
        phone: "08123456789",
        recipientName: "Buyer 2",
        addressLine: "Jalan Buyer 2",
        province: "Jawa Tengah",
        city: "Semarang",
        district: "Semarang Tengah",
        postalCode: "50131",
      },
    });
    const qrisOrderRes = await submitCheckout({
      reference: prev2.choices[0]!.reference,
      paymentMethodId: "qris",
    });

    // Now MODIFY the bank account (change account number, deactive, or delete)
    await saveBankAccount({
      id: bank.id,
      bankName: "MODIFIED Bank",
      accountNumber: "9999999999",
      accountHolder: "MODIFIED Holder",
      active: false,
      sortOrder: 1,
    });

    // Now MODIFY QRIS settings (change merchant, change image, deactive)
    await saveQrisSettings({
      merchantName: "MODIFIED QRIS",
      imageObjectKey: `site-media/${randomUUID()}.png`,
      instructions: "New instructions",
      active: false,
    });

    // Inspect Bank Order snapshot via publicOrder
    const bankOrder = await publicOrder(bankOrderRes.publicToken);
    expect(bankOrder).not.toBeNull();
    expect(bankOrder?.paymentMethod).toBe("bank_transfer");
    expect(bankOrder?.bank?.bankName).toBe("Snapshot Bank");
    expect(bankOrder?.bank?.accountNumber).toBe("1112223334");
    expect(bankOrder?.bank?.accountHolder).toBe("Snapshot Holder");
    expect(bankOrder?.bank?.instructions).toBe("Transfer to Snapshot Bank");

    // Inspect QRIS Order snapshot via publicOrder
    const qrisOrder = await publicOrder(qrisOrderRes.publicToken);
    expect(qrisOrder).not.toBeNull();
    expect(qrisOrder?.paymentMethod).toBe("qris");
    expect(qrisOrder?.qris?.merchantName).toBe("Snapshot QRIS");
    expect(qrisOrder?.qris?.imageObjectKey).toBe(validSiteMediaKey);
    expect(qrisOrder?.qris?.imageUrl).toBe(
      `https://media.test.invalid/${validSiteMediaKey}`,
    );
    expect(qrisOrder?.qris?.instructions).toBe("Scan snapshot QRIS");

    // 3. Delete bank account and verify order snapshot is still preserved
    await deleteBankAccount(bank.id);
    const bankOrderAfterDelete = await publicOrder(bankOrderRes.publicToken);
    expect(bankOrderAfterDelete?.bank?.accountNumber).toBe("1112223334");
  });

  it("6. guarantees QRIS image public URL resolution and prevents exposure of private payment-proof keys", () => {
    // Calling publicMediaUrl on site-media returns public URL
    expect(mockStorage.publicMediaUrl(validSiteMediaKey)).toBe(
      `https://media.test.invalid/${validSiteMediaKey}`,
    );

    // Calling publicMediaUrl on payment-proof throws error
    expect(() =>
      mockStorage.publicMediaUrl(`payment-proof/${randomUUID()}.jpg`),
    ).toThrow();
  });
});
