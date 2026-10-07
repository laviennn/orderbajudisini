import "server-only";
import { eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { users, permissions, rolePermissions } from "@/server/db/schema";
import type { Executor } from "@/server/db/operations";
import type { Principal } from "./policy";
export type Identity = { id: string; sessionVersion: number };
export async function loadPrincipal(
  db: Executor,
  identity: Identity,
): Promise<Principal> {
  const rows = await db
    .select({
      id: users.id,
      status: users.status,
      sessionVersion: users.sessionVersion,
      permission: permissions.key,
    })
    .from(users)
    .leftJoin(rolePermissions, eq(users.roleId, rolePermissions.roleId))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(users.id, identity.id));
  const user = rows[0];
  if (!user || user.sessionVersion !== identity.sessionVersion)
    throw new AppError("UNAUTHENTICATED");
  if (user.status !== "active") throw new AppError("FORBIDDEN");
  return {
    id: user.id,
    status: user.status,
    permissions: rows.flatMap((row) =>
      row.permission ? [row.permission] : [],
    ),
  };
}
