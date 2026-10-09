import "server-only";
import { z } from "zod";
import {
  productStates,
  orderStates,
  paymentStates,
  reviewStates,
  userStates,
} from "@/lib/domain/states";
const statusValue = z.enum([
  ...productStates,
  ...orderStates,
  ...paymentStates,
  ...reviewStates,
  ...userStates,
]);
import type { Executor } from "@/server/db/operations";
import { auditLogs } from "@/server/db/schema";
const metadataSchema = z
  .object({
    from: statusValue.optional(),
    to: statusValue.optional(),
    roleId: z.uuid().optional(),
    previousRoleId: z.uuid().optional(),
    changedFields: z
      .array(z.string().regex(/^[a-zA-Z]+$/))
      .max(30)
      .optional(),
  })
  .strict();
export const auditActions = [
  "owner.bootstrapped",
  "operator.created",
  "operator.password_reset",
  "operator.role_changed",
  "operator.activated",
  "operator.deactivated",
  "product.created",
  "product.updated",
  "product.unpublished",
  "category.updated",
  "media.attached",
  "media.updated",
  "media.removed",
  "product.published",
  "product.archived",
  "payment.verified",
  "payment.rejected",
  "order.status_changed",
  "tracking.changed",
  "banner.updated",
  "banner.deleted",
  "social.updated",
  "seo.updated",
  "store.updated",
  "bank.updated",
  "bank.deleted",
  "promotion.updated",
  "product.eligibility_changed",
  "review.moderated",
  "qris.updated",
] as const;
export async function writeAudit(
  db: Executor,
  input: {
    actorId: string | null;
    action: (typeof auditActions)[number];
    entityType: string;
    entityId: string;
    metadata?: z.infer<typeof metadataSchema>;
  },
) {
  await db.insert(auditLogs).values({
    actorUserId: input.actorId,
    action: z.enum(auditActions).parse(input.action),
    entityType: z
      .string()
      .regex(/^[a-z_]+$/)
      .parse(input.entityType),
    entityId: z.string().max(64).parse(input.entityId),
    metadata: metadataSchema.parse(input.metadata ?? {}),
  });
}
