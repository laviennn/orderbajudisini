import "server-only";
import { eq, desc, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { bundleTerms } from "@/lib/domain/pricing";
import { AppError } from "@/lib/errors";
import { withStaff } from "@/server/auth/authorize";
import { promotions, promotionProducts, products } from "@/server/db/schema";
import { writeAudit } from "./audit";
export const promotionInput = z
  .object({
    id: z.uuid().optional(),
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
    const { id, productIds, ...values } = data;
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
