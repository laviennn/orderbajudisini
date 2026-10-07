import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { withStaff } from "@/server/auth/authorize";
import { reviews, orderItems } from "@/server/db/schema";
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
      .object({ id: z.uuid(), status: z.enum(["approved", "rejected"]) })
      .strict()
      .parse(input);
    const [review] = await tx
      .select()
      .from(reviews)
      .where(eq(reviews.id, data.id))
      .for("update");
    if (!review) throw new AppError("NOT_FOUND");
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
      return { id: review.id, status: review.status };
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
    return { id: review.id, status: data.status };
  });
}
