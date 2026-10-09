import "server-only";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { withStaff } from "@/server/auth/authorize";
import { listInput, searchPattern } from "@/lib/admin-operations";
import { reviewStates } from "@/lib/domain/states";
import { reviews, orderItems, products, users } from "@/server/db/schema";
import { writeAudit } from "./audit";
export async function reviewModerationQueue(page = 1) {
  return withStaff("reviews.read", (tx) => {
    z.number().int().min(1).max(10000).parse(page);
    return tx
      .select()
      .from(reviews)
      .where(eq(reviews.status, "pending"))
      .orderBy(asc(reviews.createdAt), asc(reviews.id))
      .limit(50)
      .offset((page - 1) * 50);
  });
}
export async function moderateReview(input: unknown) {
  return withStaff("reviews.moderate", async (tx, actor) => {
    const data = z
      .object({
        id: z.uuid(),
        status: z.enum(["approved", "rejected"]),
        updatedAt: z.iso.datetime().optional(),
      })
      .strict()
      .parse(input);
    const [review] = await tx
      .select()
      .from(reviews)
      .where(eq(reviews.id, data.id))
      .for("update");
    if (!review) throw new AppError("NOT_FOUND");
    if (
      data.updatedAt &&
      new Date(data.updatedAt).getTime() !== review.updatedAt.getTime()
    )
      throw new AppError("CONFLICT");
    if (review.orderId) {
      const eligible = await tx
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, review.orderId),
            eq(orderItems.productId, review.productId),
          ),
        )
        .limit(1);
      if (!eligible.length) throw new AppError("VALIDATION_ERROR");
    }
    if (review.status === data.status)
      return {
        id: review.id,
        status: review.status,
        productId: review.productId,
      };
    await tx
      .update(reviews)
      .set({
        status: data.status,
        moderatedBy: actor.id,
        moderatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, review.id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "review.moderated",
      entityType: "review",
      entityId: review.id,
      metadata: { from: review.status, to: data.status },
    });
    return { id: review.id, status: data.status, productId: review.productId };
  });
}

export async function listAdminReviews(input: unknown = {}) {
  return withStaff("reviews.read", async (tx) => {
    const f = listInput
      .extend({
        status: z
          .enum(["", ...reviewStates])
          .catch("pending")
          .default("pending"),
      })
      .parse(input);
    const q = searchPattern(f.q);
    const where = and(
      f.status ? eq(reviews.status, f.status) : undefined,
      f.q
        ? or(
            ilike(reviews.reviewerName, q),
            ilike(products.name, q),
            ilike(products.sku, q),
          )
        : undefined,
    );
    const items = await tx
      .select({
        id: reviews.id,
        productId: reviews.productId,
        productName: products.name,
        productSku: products.sku,
        productSlug: products.slug,
        reviewerName: reviews.reviewerName,
        rating: reviews.rating,
        body: reviews.body,
        status: reviews.status,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        moderatedAt: reviews.moderatedAt,
        moderator: users.name,
      })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .leftJoin(users, eq(users.id, reviews.moderatedBy))
      .where(where)
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize);
    const [count] = await tx
      .select({ count: sql<number>`count(*)::integer` })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .where(where);
    return { items, total: count?.count ?? 0, ...f };
  });
}
