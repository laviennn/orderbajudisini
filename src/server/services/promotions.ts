import "server-only";
import { eq, desc, asc, sql, and, or, ilike, inArray } from "drizzle-orm";
import { z } from "zod";
import { bundleTerms } from "@/lib/domain/pricing";
import { AppError } from "@/lib/errors";
import { withStaff } from "@/server/auth/authorize";
import {
  promotions,
  promotionProducts,
  products,
  categories,
} from "@/server/db/schema";
import { listInput, searchPattern } from "@/lib/admin-operations";
import { lockEditableProduct, checkRevision } from "./admin-products";
import { priceLockedProducts } from "./pricing";
import { writeAudit } from "./audit";
export const promotionInput = z
  .object({
    id: z.uuid().optional(),
    updatedAt: z.iso.datetime().optional(),
    name: z.string().trim().min(1).max(200),
    requiredQuantity: z.number().int().min(2).max(100),
    bundlePrice: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    active: z.boolean(),
    startsAt: z.date().nullable(),
    endsAt: z.date().nullable(),
    priority: z.number().int().min(0).max(1000),
    categoryId: z.uuid().nullable(),
    allocationStrategy: z
      .enum(["highest_price_first", "lowest_price_first"])
      .nullable(),
    pricePolicy: z.enum(["discount_only", "fixed_bundle"]).nullable(),
    productIds: z.array(z.uuid()).max(1000).default([]),
  })
  .strict()
  .refine(
    (v) =>
      !v.active || (v.allocationStrategy !== null && v.pricePolicy !== null),
  )
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt)
  .refine(
    (v) =>
      !v.active ||
      (v.requiredQuantity === bundleTerms.requiredQuantity &&
        v.bundlePrice === bundleTerms.bundlePrice &&
        v.pricePolicy === bundleTerms.pricePolicy),
  );
export async function listPromotions() {
  return withStaff("promotions.read", (tx) =>
    tx
      .select()
      .from(promotions)
      .orderBy(desc(promotions.priority), asc(promotions.id))
      .limit(100),
  );
}
export async function savePromotion(input: unknown) {
  return withStaff("promotions.manage", async (tx, actor) => {
    const data = promotionInput.parse(input);
    await tx.execute(sql`select pg_advisory_xact_lock(73102)`);
    const { id, updatedAt, productIds, ...values } = data;
    if (id) {
      const [old] = await tx
        .select()
        .from(promotions)
        .where(eq(promotions.id, id))
        .for("update");
      if (!old) throw new AppError("NOT_FOUND");
      checkRevision(old.updatedAt, updatedAt);
    }
    const rows = id
      ? await tx
          .update(promotions)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(promotions.id, id))
          .returning({ id: promotions.id })
      : await tx
          .insert(promotions)
          .values(values)
          .returning({ id: promotions.id });
    const row = rows[0];
    if (!row) throw new AppError("NOT_FOUND");
    await tx
      .delete(promotionProducts)
      .where(eq(promotionProducts.promotionId, row.id));
    if (productIds.length)
      await tx.insert(promotionProducts).values(
        [...new Set(productIds)].map((productId) => ({
          promotionId: row.id,
          productId,
        })),
      );
    await writeAudit(tx, {
      actorId: actor.id,
      action: "promotion.updated",
      entityType: "promotion",
      entityId: row.id,
      metadata: { changedFields: Object.keys(values) },
    });
    return row;
  });
}
export async function setProductPromotionEligibility(input: unknown) {
  return withStaff("promotions.manage", async (tx, actor) => {
    const data = z
      .object({ productId: z.uuid(), eligible: z.boolean() })
      .strict()
      .parse(input);
    await tx.execute(sql`select pg_advisory_xact_lock(73102)`);
    await lockEditableProduct(tx, data.productId);
    const [row] = await tx
      .update(products)
      .set({
        promotionEligible: data.eligible,
        updatedAt: new Date(),
        updatedBy: actor.id,
      })
      .where(eq(products.id, data.productId))
      .returning({ id: products.id });
    if (!row) throw new AppError("NOT_FOUND");
    await writeAudit(tx, {
      actorId: actor.id,
      action: "product.eligibility_changed",
      entityType: "product",
      entityId: row.id,
      metadata: { changedFields: ["promotionEligible"] },
    });
    return row;
  });
}

export async function promotionEditorData() {
  return withStaff("promotions.read", async (tx) => {
    const items = await tx
      .select()
      .from(promotions)
      .orderBy(desc(promotions.priority), asc(promotions.id))
      .limit(101);
    if (items.length > 100) throw new AppError("VALIDATION_ERROR");
    const targets = items.length
      ? await tx
          .select({
            promotionId: promotionProducts.promotionId,
            id: products.id,
            name: products.name,
            sku: products.sku,
          })
          .from(promotionProducts)
          .innerJoin(products, eq(products.id, promotionProducts.productId))
          .where(
            inArray(
              promotionProducts.promotionId,
              items.map((p) => p.id),
            ),
          )
      : [];
    return {
      items: items.map((p) => ({
        ...p,
        targets: targets.filter((t) => t.promotionId === p.id),
      })),
      categories: await tx
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .orderBy(asc(categories.name)),
    };
  });
}
export async function promotionProductSearch(input: unknown) {
  return withStaff("promotions.read", async (tx) => {
    const f = listInput.parse(input);
    const q = searchPattern(f.q);
    const items = await tx
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        status: products.status,
        promotionEligible: products.promotionEligible,
        price: products.price,
      })
      .from(products)
      .where(
        f.q ? or(ilike(products.name, q), ilike(products.sku, q)) : undefined,
      )
      .orderBy(asc(products.name), asc(products.id))
      .limit(f.pageSize + 1)
      .offset((f.page - 1) * f.pageSize);
    return {
      items: items.slice(0, f.pageSize),
      hasNext: items.length > f.pageSize,
      page: f.page,
    };
  });
}
// Read the same persisted campaigns, actual prices and eligibility as checkout.
export async function previewPromotionPricing(input: unknown) {
  return withStaff("promotions.read", async (tx) => {
    const { productIds } = z
      .object({ productIds: z.array(z.uuid()).min(1).max(100) })
      .strict()
      .parse(input);
    if (new Set(productIds).size !== productIds.length)
      throw new AppError("VALIDATION_ERROR");
    await tx.execute(sql`select pg_advisory_xact_lock_shared(73102)`);
    const items = await tx
      .select({
        id: products.id,
        categoryId: products.categoryId,
        price: products.price,
        promotionEligible: products.promotionEligible,
      })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(
        and(
          inArray(products.id, productIds),
          eq(products.status, "active"),
          eq(categories.active, true),
        ),
      )
      .orderBy(asc(products.id))
      .for("share");
    if (items.length !== productIds.length)
      throw new AppError("PRODUCT_UNAVAILABLE");
    return priceLockedProducts(
      tx,
      items.map((p) => ({ ...p, quantity: 1 })),
      new Date(),
    );
  });
}
