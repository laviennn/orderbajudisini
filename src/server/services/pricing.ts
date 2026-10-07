import "server-only";
import { and, eq, inArray, isNull, lte, gt, or, desc, asc } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { calculateCartPricing, type PricedProduct } from "@/lib/domain/pricing";
import { promotions, promotionProducts } from "@/server/db/schema";
import type { Transaction } from "@/server/db/operations";
export async function priceLockedProducts(
  tx: Transaction,
  items: PricedProduct[],
  now: Date,
) {
  const rules = await tx
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.active, true),
        or(isNull(promotions.startsAt), lte(promotions.startsAt, now)),
        or(isNull(promotions.endsAt), gt(promotions.endsAt, now)),
      ),
    )
    .orderBy(desc(promotions.priority), asc(promotions.id))
    .limit(51)
    .for("share");
  if (rules.length > 50) throw new AppError("PRICING_NOT_CONFIGURED");
  const targets = rules.length
    ? await tx
        .select()
        .from(promotionProducts)
        .where(
          inArray(
            promotionProducts.promotionId,
            rules.map((r) => r.id),
          ),
        )
        .limit(10001)
    : [];
  if (targets.length > 10000) throw new AppError("PRICING_NOT_CONFIGURED");
  return calculateCartPricing(
    items,
    rules.map((r) => ({
      ...r,
      productIds: targets
        .filter((t) => t.promotionId === r.id)
        .map((t) => t.productId),
    })),
    now,
  );
}
