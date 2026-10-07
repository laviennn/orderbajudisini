import { beforeAll, afterAll, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { startTestDatabase } from "./database";
import * as s from "@/server/db/schema";
import type { StorageAdapter } from "@/server/storage/r2";
let database: Awaited<ReturnType<typeof startTestDatabase>>;
const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/server/db", () => ({ getDatabase: () => database.db }));
vi.mock("@/server/auth", () => ({
  auth: authMock,
  authenticationEnabled: () => true,
}));
const objects = new Map<string, { body: Buffer; mime: string }>();
let failWrites = false;
let failDeletes = false;
const adapter: StorageAdapter = {
  createUpload: async (input) => ({
    key: `${input.purpose}/${randomUUID()}.png`,
    url: "https://upload.example.invalid",
    headers: { "Content-Type": input.mime },
    expiresIn: 120,
  }),
  inspectObject: async (_purpose, key) => {
    const value = objects.get(key);
    if (!value) throw new Error("missing test object");
    return { bytes: value.body.length, mime: value.mime };
  },
  readProductSource: async (key) => objects.get(key)!.body,
  writeProductVariant: async (key, body) => {
    if (failWrites) throw new Error("TEST provider write failure");
    objects.set(key, { body, mime: "image/webp" });
  },
  deleteObject: async (_purpose, key) => {
    if (failDeletes) throw new Error("TEST provider delete failure");
    objects.delete(key);
  },
  publicMediaUrl: (key) => `https://media.example.invalid/${key}`,
  privateProofUrl: async () => {
    throw new Error("not used");
  },
};
vi.mock("@/server/storage/r2", () => ({ getStorage: () => adapter }));
import { bootstrapOwner } from "@/server/services/bootstrap";
import { createOperator } from "@/server/services/operators";
import {
  saveProduct,
  adminProduct,
  saveCategory,
  changeProductStatus,
  adminCategories,
} from "@/server/services/admin-products";
import {
  authorizeProductUpload,
  completeProductUpload,
  changeProductMedia,
  cleanupProductMedia,
} from "@/server/services/admin-media";
import { getProduct, listCatalog } from "@/server/repositories/catalog";
import { validateCart } from "@/server/services/cart";
import { parseCatalog } from "@/lib/catalog";
let owner: string,
  orderOperator: string,
  catalogOperator: string,
  categoryId: string,
  png: Buffer;
const login = (id: string) =>
  authMock.mockResolvedValue({ user: { id, sessionVersion: 0 } });
const input = (extra: Record<string, unknown> = {}) => {
  const unique = randomUUID().slice(0, 8);
  return {
    name: `TEST Product ${unique}`,
    sku: `TEST-${unique}`,
    slug: `test-${unique}`,
    categoryId,
    brand: "TEST",
    description: "TEST factual description",
    shortDescription: "",
    price: 45000,
    compareAtPrice: null,
    sizeLabel: "L",
    conditionGrade: "TEST good",
    conditionNotes: "TEST fading",
    defectNotes: "TEST sleeve mark",
    quantity: 1,
    weightGrams: 200,
    promotionEligible: false,
    seoTitle: "TEST SEO",
    seoDescription: "TEST description",
    measurements: [
      { key: "chest_width", label: "Lebar dada", value: 56.5, unit: "cm" },
    ],
    ...extra,
  };
};
async function upload(productId: string, defect = false) {
  const intent = await authorizeProductUpload({
    productId,
    mime: "image/png",
    bytes: png.length,
    altText: "TEST garment",
    isDefectImage: defect,
  });
  const [row] = await database.db
    .select()
    .from(s.mediaUploads)
    .where(eq(s.mediaUploads.id, intent.id));
  objects.set(row!.sourceKey, { body: png, mime: "image/png" });
  await completeProductUpload({ productId, uploadId: intent.id });
  return intent.id;
}
beforeAll(async () => {
  database = await startTestDatabase();
  const result = await bootstrapOwner(database.db, {
    name: "TEST Owner",
    email: "owner@test.invalid",
    password: "TEST owner password only",
  });
  owner = result.id;
  login(owner);
  categoryId = (
    await saveCategory({
      name: "TEST Category",
      slug: "test-category",
      description: "",
      active: true,
      sortOrder: 0,
      seoTitle: "",
      seoDescription: "",
    })
  ).id;
  const roles = await database.db.select().from(s.roles);
  orderOperator = (
    await createOperator({
      name: "TEST Order",
      email: "order@test.invalid",
      password: "TEST operator password only",
      roleId: roles.find((r) => r.name === "Order Operator")!.id,
    })
  ).id;
  catalogOperator = (
    await createOperator({
      name: "TEST Catalog",
      email: "catalog@test.invalid",
      password: "TEST operator password only",
      roleId: roles.find((r) => r.name === "Catalog Operator")!.id,
    })
  ).id;
  png = await sharp({
    create: { width: 1800, height: 2200, channels: 3, background: "#789080" },
  })
    .png()
    .toBuffer();
});
beforeEach(() => {
  login(owner);
  failWrites = false;
  failDeletes = false;
});
afterAll(async () => database?.stop());
it("creates draft and persists fields/measurements/SEO without exposing it publicly", async () => {
  const data = input({ promotionEligible: true });
  const created = await saveProduct(data);
  const p = await adminProduct(created.id);
  expect(p).toMatchObject({
    status: "draft",
    promotionEligible: true,
    conditionNotes: data.conditionNotes,
    defectNotes: data.defectNotes,
    seoTitle: data.seoTitle,
  });
  expect(p.measurements[0]?.value).toBe(56.5);
  expect(await getProduct(p.slug)).toBeNull();
});
it("validates money, unique SKU/slug, stale edits and published slug confirmation", async () => {
  const data = input();
  const row = await saveProduct(data);
  await expect(
    saveProduct({ ...input(), sku: data.sku }),
  ).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
    fieldErrors: { sku: expect.any(Array) },
  });
  await expect(
    saveProduct({ ...input(), slug: data.slug }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await expect(saveProduct(input({ price: -1 }))).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
  await expect(saveProduct(input({ price: 1.5 }))).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
  await expect(
    saveProduct({ ...data, id: row.id, updatedAt: new Date(0).toISOString() }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await upload(row.id);
  await changeProductStatus({
    id: row.id,
    updatedAt: row.updatedAt.toISOString(),
    action: "publish",
  });
  const current = await adminProduct(row.id);
  await expect(
    saveProduct({
      ...data,
      id: row.id,
      updatedAt: current.updatedAt,
      slug: `changed-${data.slug}`,
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
});
it("enforces permissions for creation, publish, archive, media and campaign eligibility", async () => {
  const row = await saveProduct(input());
  login(orderOperator);
  for (const operation of [
    () => saveProduct(input()),
    () =>
      changeProductStatus({
        id: row.id,
        updatedAt: row.updatedAt.toISOString(),
        action: "publish",
      }),
    () =>
      changeProductStatus({
        id: row.id,
        updatedAt: row.updatedAt.toISOString(),
        action: "archive",
      }),
    () =>
      authorizeProductUpload({
        productId: row.id,
        mime: "image/png",
        bytes: 100,
        altText: "TEST",
        isDefectImage: false,
      }),
    () =>
      changeProductMedia({
        productId: row.id,
        action: "remove",
        imageId: randomUUID(),
      }),
  ])
    await expect(operation()).rejects.toMatchObject({ code: "FORBIDDEN" });
  login(catalogOperator);
  await expect(
    saveProduct(input({ promotionEligible: true })),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect((await saveProduct(input())).id).toBeTruthy();
});
it("rejects unsupported/oversized and mismatched actual image data", async () => {
  const row = await saveProduct(input());
  for (const data of [
    { mime: "image/svg+xml", bytes: 100 },
    { mime: "image/png", bytes: 11 * 1024 * 1024 },
  ])
    await expect(
      authorizeProductUpload({
        productId: row.id,
        ...data,
        altText: "TEST",
        isDefectImage: false,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  const bad = Buffer.from("not an image");
  const intent = await authorizeProductUpload({
    productId: row.id,
    mime: "image/png",
    bytes: bad.length,
    altText: "TEST",
    isDefectImage: false,
  });
  const [stored] = await database.db
    .select()
    .from(s.mediaUploads)
    .where(eq(s.mediaUploads.id, intent.id));
  objects.set(stored!.sourceKey, { body: bad, mime: "image/png" });
  await expect(
    completeProductUpload({ productId: row.id, uploadId: intent.id }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect((await adminProduct(row.id)).images).toHaveLength(0);
});
it("generates real variants, binds uploads to product and prevents duplicate completion", async () => {
  const row = await saveProduct(input());
  const uploadId = await upload(row.id);
  await completeProductUpload({ productId: row.id, uploadId });
  const images = await database.db
    .select()
    .from(s.productImages)
    .where(eq(s.productImages.productId, row.id));
  expect(images).toHaveLength(3);
  expect(images.map((i) => i.variant).sort()).toEqual([
    "card",
    "detail",
    "thumbnail",
  ]);
  for (const image of images) {
    const meta = await sharp(objects.get(image.objectKey)!.body).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(image.width);
    expect(meta.exif).toBeUndefined();
    expect(image.bytes).toBeLessThan(1500000);
  }
  const other = await saveProduct(input());
  await expect(
    completeProductUpload({ productId: other.id, uploadId }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("publishes, edits pricing/SEO/eligibility, reorders image families and archives across public services", async () => {
  const data = input();
  const row = await saveProduct(data);
  await upload(row.id);
  await upload(row.id, true);
  await changeProductStatus({
    id: row.id,
    updatedAt: row.updatedAt.toISOString(),
    action: "publish",
  });
  expect((await listCatalog(parseCatalog({ q: data.name }))).items[0]?.id).toBe(
    row.id,
  );
  let p = await adminProduct(row.id);
  const originalUrl = (await getProduct(p.slug))!.images[0]!.url;
  expect((await getProduct(p.slug))!.images).toHaveLength(2);
  await changeProductMedia({
    action: "edit",
    productId: p.id,
    imageId: p.images[1]!.id,
    altText: "TEST replacement",
    isDefectImage: false,
  });
  await changeProductMedia({
    action: "reorder",
    productId: p.id,
    ids: [p.images[1]!.id, p.images[0]!.id],
  });
  expect((await getProduct(p.slug))!.images[0]!.url).not.toBe(originalUrl);
  expect((await getProduct(p.slug))!.images[0]!.sources).toHaveLength(3);
  const edit = await saveProduct({
    ...data,
    id: p.id,
    updatedAt: p.updatedAt,
    price: 50000,
    seoTitle: "TEST changed SEO",
    promotionEligible: true,
  });
  expect(await getProduct(p.slug)).toMatchObject({
    price: 50000,
    seoTitle: "TEST changed SEO",
  });
  expect((await adminProduct(p.id)).images).toHaveLength(2);
  expect((await validateCart({ ids: [p.id] })).pricing?.merchandiseTotal).toBe(
    50000,
  );
  await changeProductStatus({
    id: p.id,
    updatedAt: edit.updatedAt.toISOString(),
    action: "archive",
  });
  expect(await getProduct(p.slug)).toBeNull();
  p = await adminProduct(p.id);
  expect(p.measurements[0]?.value).toBe(56.5);
});
it("keeps recoverable plans for R2 failures and durable deletion jobs", async () => {
  const row = await saveProduct(input());
  failWrites = true;
  await expect(upload(row.id)).rejects.toBeTruthy();
  expect((await adminProduct(row.id)).images).toHaveLength(0);
  const [plan] = await database.db
    .select()
    .from(s.mediaUploads)
    .where(eq(s.mediaUploads.productId, row.id));
  expect(plan?.ready).toBe(false);
  failWrites = false;
  await completeProductUpload({ productId: row.id, uploadId: plan!.id });
  const p = await adminProduct(row.id);
  failDeletes = true;
  await changeProductMedia({
    action: "remove",
    productId: row.id,
    imageId: p.images[0]!.id,
  });
  expect((await adminProduct(row.id)).images).toHaveLength(0);
  expect((await cleanupProductMedia(row.id)).failed).toBe(3);
  expect(
    await database.db
      .select()
      .from(s.mediaDeletions)
      .where(eq(s.mediaDeletions.productId, row.id)),
  ).toHaveLength(3);
  failDeletes = false;
  expect((await cleanupProductMedia(row.id)).cleaned).toBe(3);
  await database.db
    .update(s.mediaUploads)
    .set({ expiresAt: new Date(0) })
    .where(eq(s.mediaUploads.id, plan!.id));
  await cleanupProductMedia(row.id);
  expect(objects.has(plan!.sourceKey)).toBe(false);
});
it("revalidates existing bundle pricing after editor eligibility changes", async () => {
  const { savePromotion } = await import("@/server/services/promotions");
  await savePromotion({
    name: "TEST bundle",
    requiredQuantity: 3,
    bundlePrice: 100000,
    active: true,
    startsAt: null,
    endsAt: null,
    priority: 1,
    categoryId,
    allocationStrategy: "highest_price_first",
    pricePolicy: "discount_only",
  });
  const inputs = [
    input({ promotionEligible: true }),
    input({ promotionEligible: true }),
    input(),
  ];
  const ids: string[] = [];
  for (const data of inputs) {
    const row = await saveProduct(data);
    ids.push(row.id);
    await upload(row.id);
    await changeProductStatus({
      id: row.id,
      updatedAt: row.updatedAt.toISOString(),
      action: "publish",
    });
  }
  expect((await validateCart({ ids })).pricing?.merchandiseTotal).toBe(135000);
  const third = await adminProduct(ids[2]!);
  await saveProduct({
    ...inputs[2],
    id: third.id,
    updatedAt: third.updatedAt,
    promotionEligible: true,
  });
  expect((await validateCart({ ids })).pricing?.merchandiseTotal).toBe(100000);
  const edited = await adminProduct(third.id);
  await saveProduct({
    ...inputs[2],
    id: third.id,
    updatedAt: edited.updatedAt,
    promotionEligible: false,
  });
  expect((await validateCart({ ids })).pricing?.merchandiseTotal).toBe(135000);
});
it("protects the last publishable image and commerce-controlled products", async () => {
  const data = input();
  const row = await saveProduct(data);
  await upload(row.id);
  await changeProductStatus({
    id: row.id,
    updatedAt: row.updatedAt.toISOString(),
    action: "publish",
  });
  const active = await adminProduct(row.id);
  await expect(
    changeProductMedia({
      action: "remove",
      productId: row.id,
      imageId: active.images[0]!.id,
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await expect(
    changeProductMedia({
      action: "edit",
      productId: row.id,
      imageId: active.images[0]!.id,
      altText: "TEST",
      isDefectImage: true,
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  for (const status of ["reserved", "sold"] as const) {
    await database.db
      .update(s.products)
      .set({ status, quantity: 0 })
      .where(eq(s.products.id, row.id));
    await expect(
      saveProduct({ ...data, id: row.id, updatedAt: active.updatedAt }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      changeProductStatus({
        id: row.id,
        updatedAt: active.updatedAt,
        action: "publish",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      authorizeProductUpload({
        productId: row.id,
        mime: "image/png",
        bytes: png.length,
        altText: "TEST",
        isDefectImage: false,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  }
});
it("hides inactive categories without orphaning products and records audits", async () => {
  const category = (await adminCategories()).find((c) => c.id === categoryId)!;
  await saveCategory({
    id: category.id,
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
    updatedAt: category.updatedAt.toISOString(),
    description: category.description ?? "",
    seoTitle: category.seoTitle ?? "",
    seoDescription: category.seoDescription ?? "",
    active: false,
  });
  expect((await listCatalog(parseCatalog({}))).items).toHaveLength(0);
  expect(
    (await database.db.select().from(s.auditLogs)).some(
      (a) => a.action === "media.attached",
    ),
  ).toBe(true);
});
