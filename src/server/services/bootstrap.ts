import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import type { Database, Transaction } from "@/server/db/operations";
import { databaseOperation } from "@/server/db/operations";
import {
  users,
  roles,
  permissions,
  rolePermissions,
  bootstrapState,
} from "@/server/db/schema";
import { defaultRoles, permissionKeys } from "@/server/auth/policy";
import { hashPassword, passwordSchema } from "@/server/auth/password";
import { writeAudit } from "./audit";
// Shared with the authorization transaction boundary; no HTTP route exposes bootstrap or role seeding.
const identityLock = 73101;
export async function seedAccessControl(tx: Transaction) {
  for (const key of permissionKeys)
    await tx.insert(permissions).values({ key }).onConflictDoNothing();
  const stored = await tx.select().from(permissions);
  for (const [name, grants] of Object.entries(defaultRoles)) {
    const [role] = await tx
      .insert(roles)
      .values({ name, isOwner: name === "Owner" })
      .onConflictDoUpdate({
        target: roles.name,
        set: { isOwner: name === "Owner" },
      })
      .returning();
    if (!role) throw new AppError("INTERNAL_ERROR");
    // Insert missing defaults, never silently remove deliberately added permissions.
    for (const grant of grants) {
      const permission = stored.find((p) => p.key === grant);
      if (!permission) throw new AppError("INTERNAL_ERROR");
      await tx
        .insert(rolePermissions)
        .values({ roleId: role.id, permissionId: permission.id })
        .onConflictDoNothing();
    }
  }
}
export const ownerInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase().trim()),
    password: passwordSchema,
  })
  .strict();
export async function bootstrapOwner(db: Database, input: unknown) {
  return databaseOperation(async () => {
    const data = ownerInput.parse(input);
    const passwordHash = await hashPassword(data.password);
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${identityLock})`);
      if ((await tx.select().from(bootstrapState).limit(1)).length)
        throw new AppError("BOOTSTRAP_CLOSED");
      const existing = await tx
        .select({ id: users.id })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(eq(roles.isOwner, true))
        .limit(1);
      if (existing.length) throw new AppError("BOOTSTRAP_CLOSED");
      await seedAccessControl(tx);
      const [role] = await tx
        .select()
        .from(roles)
        .where(and(eq(roles.name, "Owner"), eq(roles.isOwner, true)));
      if (!role) throw new AppError("INTERNAL_ERROR");
      const [user] = await tx
        .insert(users)
        .values({
          name: data.name,
          email: data.email,
          passwordHash,
          roleId: role.id,
          status: "active",
        })
        .returning({ id: users.id });
      if (!user) throw new AppError("INTERNAL_ERROR");
      await tx.insert(bootstrapState).values({ id: 1 });
      await writeAudit(tx, {
        actorId: user.id,
        action: "owner.bootstrapped",
        entityType: "user",
        entityId: user.id,
      });
      return user;
    });
  });
}
