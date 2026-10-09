import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, users } from "@/server/db/schema";
import { withStaff } from "@/server/auth/authorize";
import { listInput, searchPattern } from "@/lib/admin-operations";
export async function listAudit(input: unknown = {}) {
  return withStaff("audit.read", async (tx) => {
    const f = listInput
      .extend({
        entity: z
          .enum([
            "",
            "product",
            "category",
            "order",
            "payment",
            "user",
            "review",
            "promotion",
            "store",
            "seo",
            "bank",
            "banner",
          ])
          .catch("")
          .default(""),
      })
      .parse(input);
    const q = searchPattern(f.q),
      where = and(
        f.entity ? eq(auditLogs.entityType, f.entity) : undefined,
        f.q
          ? or(
              ilike(auditLogs.action, q),
              ilike(auditLogs.entityId, q),
              ilike(users.name, q),
            )
          : undefined,
      );
    const items = await tx
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        createdAt: auditLogs.createdAt,
        actor: users.name,
        metadata: auditLogs.metadata,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize);
    const [count] = await tx
      .select({ count: sql<number>`count(*)::integer` })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(where);
    return { items, total: count?.count ?? 0, ...f };
  });
}
