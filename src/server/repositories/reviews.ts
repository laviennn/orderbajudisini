import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/server/db";
import { databaseOperation } from "@/server/db/operations";
import { reviews } from "@/server/db/schema";
export const reviewInput = z
  .object({
    productId: z.uuid(),
    orderId: z.uuid().nullable().optional(),
    reviewerName: z.string().trim().min(1).max(120),
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().min(1).max(5000),
  })
  .strict();
export async function listApprovedReviews(productId: string, page = 1) {
  return databaseOperation(async () => {
    z.uuid().parse(productId);
    z.number().int().min(1).max(10000).parse(page);
    return getDatabase()
      .select({
        id: reviews.id,
        reviewerName: reviews.reviewerName,
        rating: reviews.rating,
        body: reviews.body,
        createdAt: reviews.createdAt,
        verifiedPurchase: sql<boolean>`exists(select 1 from orders inner join order_items on order_items.order_id = orders.id where orders.id = reviews.order_id and orders.status = 'completed' and order_items.product_id = reviews.product_id)`,
      })
      .from(reviews)
      .where(
        and(eq(reviews.productId, productId), eq(reviews.status, "approved")),
      )
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(20)
      .offset((page - 1) * 20);
  });
}
export async function approvedReviewSummary(productId: string) {
  return databaseOperation(async () => {
    z.uuid().parse(productId);
    const [summary] = await getDatabase()
      .select({
        count: sql<number>`count(*)::integer`,
        average: sql<string | null>`avg(${reviews.rating})`,
      })
      .from(reviews)
      .where(
        and(eq(reviews.productId, productId), eq(reviews.status, "approved")),
      );
    return {
      count: summary?.count ?? 0,
      average: summary?.average ? Number(summary.average) : null,
    };
  });
}
