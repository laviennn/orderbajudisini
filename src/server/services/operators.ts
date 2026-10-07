import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { withStaff } from "@/server/auth/authorize";
import { hashPassword, passwordSchema } from "@/server/auth/password";
import { roles, users } from "@/server/db/schema";
import { writeAudit } from "./audit";
const publicFields = {
  id: users.id,
  name: users.name,
  email: users.email,
  roleId: users.roleId,
  status: users.status,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};
export const operatorInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z
      .email()
      .max(254)
      .transform((v) => v.trim().toLowerCase()),
    password: passwordSchema,
    roleId: z.uuid(),
  })
  .strict();
export async function listOperators(page = 1) {
  return withStaff("operators.read", (tx) => {
    const n = z.number().int().min(1).max(10000).parse(page);
    return tx
      .select(publicFields)
      .from(users)
      .orderBy(asc(users.createdAt), asc(users.id))
      .limit(50)
      .offset((n - 1) * 50);
  });
}
export async function getOperator(id: string) {
  return withStaff("operators.read", async (tx) => {
    const [user] = await tx
      .select(publicFields)
      .from(users)
      .where(eq(users.id, z.uuid().parse(id)))
      .limit(1);
    if (!user) throw new AppError("NOT_FOUND");
    return user;
  });
}
export async function createOperator(input: unknown) {
  return withStaff(
    "operators.manage",
    async (tx, actor) => {
      const data = operatorInput.parse(input);
      const [role] = await tx
        .select()
        .from(roles)
        .where(eq(roles.id, data.roleId));
      if (!role) throw new AppError("NOT_FOUND");
      const [user] = await tx
        .insert(users)
        .values({
          name: data.name,
          email: data.email,
          passwordHash: await hashPassword(data.password),
          roleId: role.id,
          status: "active",
        })
        .returning(publicFields);
      if (!user) throw new AppError("INTERNAL_ERROR");
      await writeAudit(tx, {
        actorId: actor.id,
        action: "operator.created",
        entityType: "user",
        entityId: user.id,
        metadata: { roleId: role.id },
      });
      return user;
    },
    true,
  );
}
export async function updateOperator(input: unknown) {
  return withStaff(
    "operators.manage",
    async (tx, actor) => {
      const data = z
        .object({
          id: z.uuid(),
          roleId: z.uuid().optional(),
          status: z.enum(["active", "inactive"]).optional(),
        })
        .strict()
        .refine((v) => v.roleId !== undefined || v.status !== undefined)
        .parse(input);
      const [current] = await tx
        .select({ user: users, owner: roles.isOwner })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.id, data.id));
      if (!current) throw new AppError("NOT_FOUND");
      const [role] = await tx
        .select()
        .from(roles)
        .where(eq(roles.id, data.roleId ?? current.user.roleId));
      if (!role) throw new AppError("NOT_FOUND");
      const status = data.status ?? current.user.status;
      if (
        current.owner &&
        current.user.status === "active" &&
        (!role.isOwner || status !== "active")
      ) {
        const remaining = await tx
          .select({ id: users.id })
          .from(users)
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(
            and(
              ne(users.id, data.id),
              eq(users.status, "active"),
              eq(roles.isOwner, true),
            ),
          )
          .limit(1);
        if (!remaining.length) throw new AppError("LAST_OWNER");
      }
      if (role.id === current.user.roleId && status === current.user.status)
        return { id: current.user.id, changed: false };
      await tx
        .update(users)
        .set({
          roleId: role.id,
          status,
          sessionVersion: sql`${users.sessionVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, data.id));
      if (role.id !== current.user.roleId)
        await writeAudit(tx, {
          actorId: actor.id,
          action: "operator.role_changed",
          entityType: "user",
          entityId: data.id,
          metadata: { previousRoleId: current.user.roleId, roleId: role.id },
        });
      if (status !== current.user.status)
        await writeAudit(tx, {
          actorId: actor.id,
          action:
            status === "active" ? "operator.activated" : "operator.deactivated",
          entityType: "user",
          entityId: data.id,
        });
      return { id: data.id, changed: true };
    },
    true,
  );
}
