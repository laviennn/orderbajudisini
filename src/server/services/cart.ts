import "server-only";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/server/db";
import { databaseOperation } from "@/server/db/operations";
import { categories, productImages, products } from "@/server/db/schema";
import { priceLockedProducts } from "./pricing";
import { primaryImage, publicImage } from "@/server/repositories/catalog";
export const cartInput = z
  .object({
    ids: z
      .array(z.uuid().transform((id) => id.toLowerCase()))
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
export async function validateCart(input: unknown) {
  return databaseOperation(async () => {
    const { ids } = cartInput.parse(input);
    if (!ids.length) return { items: [], pricing: null };
    return getDatabase().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(73102)`);
      const rows = await tx
        .select({
          id: products.id,
          image: primaryImage,
          name: products.name,
          slug: products.slug,
          price: products.price,
          status: products.status,
          quantity: products.quantity,
          promotionEligible: products.promotionEligible,
          categoryId: products.categoryId,
        })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(
          and(
            inArray(products.id, ids),
            inArray(products.status, ["active", "sold", "reserved"]),
            eq(categories.active, true),
          ),
        )
        .orderBy(products.id)
        .for("share");

      const matchedProductIds = new Set(rows.map((r) => r.id));
      const remainingIds = ids.filter((id) => !matchedProductIds.has(id));
      const imageRows = remainingIds.length
        ? await tx
            .select({
              id: productImages.id,
              productId: products.id,
              image: {
                objectKey: productImages.objectKey,
                altText: productImages.altText,
                width: productImages.width,
                height: productImages.height,
                bytes: productImages.bytes,
                isDefectImage: productImages.isDefectImage,
                sortOrder: productImages.sortOrder,
              },
              name: products.name,
              slug: products.slug,
              price: products.price,
              status: products.status,
              quantity: products.quantity,
              promotionEligible: products.promotionEligible,
              categoryId: products.categoryId,
              sortOrder: productImages.sortOrder,
            })
            .from(productImages)
            .innerJoin(products, eq(productImages.productId, products.id))
            .innerJoin(categories, eq(products.categoryId, categories.id))
            .where(
              and(
                inArray(productImages.id, remainingIds),
                inArray(products.status, ["active", "sold", "reserved"]),
                eq(categories.active, true),
              ),
            )
            .for("share")
        : [];

      const normalizedImageRows = imageRows.map((img) => ({
        id: img.id,
        image: img.image,
        name: `${img.name} (Baju #${img.sortOrder + 1})`,
        slug: img.slug,
        price: img.price,
        status: img.status,
        quantity: img.quantity,
        promotionEligible: img.promotionEligible,
        categoryId: img.categoryId,
      }));

      const allRows = [...rows, ...normalizedImageRows];
      const available = allRows.filter(
        (p) => p.status === "active" && p.quantity > 0,
      );
      const calculated = available.length
        ? await priceLockedProducts(
            tx,
            available.map((p) => ({
              id: p.id,
              price: p.price ?? 50000,
              quantity: 1,
              promotionEligible: p.promotionEligible,
              categoryId: p.categoryId,
            })),
            new Date(),
          )
        : null;
      return {
        items: ids.map((id) => {
          const row = allRows.find((p) => p.id === id);
          return row
            ? {
                id,
                name: row.name,
                image: publicImage(row.image),
                slug: row.slug,
                price: row.price,
                available: row.status === "active" && row.quantity > 0,
                status: row.status,
              }
            : {
                id,
                name: "Produk tidak tersedia",
                image: null,
                slug: null,
                price: null,
                available: false,
                status: "unavailable",
              };
        }),
        pricing: calculated
          ? {
              originalSubtotal: calculated.originalSubtotal,
              promotionDiscount: calculated.promotionDiscount,
              promotionSurcharge: calculated.promotionSurcharge,
              merchandiseTotal: calculated.merchandiseTotal,
              lines: calculated.lines,
              bundles: calculated.appliedPromotions.map((p) => ({
                name: p.name,
                count: p.bundleCount,
                quantity: p.requiredQuantity,
                price: p.bundlePrice,
              })),
            }
          : null,
      };
    });
  });
}
export type CartResult = Awaited<ReturnType<typeof validateCart>>;
