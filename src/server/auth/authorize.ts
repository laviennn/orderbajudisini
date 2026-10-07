import "server-only";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { getDatabase } from "@/server/db";
import { databaseOperation, type Transaction } from "@/server/db/operations";
import { auth, authenticationEnabled } from ".";
import { assertPermission, type Permission, type Principal } from "./policy";
import { loadPrincipal } from "./principal";
export const identityLock = 73101;
async function requireIdentity() {
  if (!authenticationEnabled()) throw new AppError("NOT_CONFIGURED");
  const session = await auth();
  const result = z
    .object({ id: z.uuid(), sessionVersion: z.number().int().nonnegative() })
    .safeParse(session?.user);
  if (!result.success) throw new AppError("UNAUTHENTICATED");
  return result.data;
}
export async function requireAuthenticatedUser(): Promise<Principal> {
  const identity = await requireIdentity();
  return databaseOperation(() => loadPrincipal(getDatabase(), identity));
}
export async function requirePermission(permission: Permission) {
  const principal = await requireAuthenticatedUser();
  assertPermission(principal, permission);
  return principal;
}
// Revocation and privileged mutations serialize against one another. No caller-provided roles/principals.
export async function withStaff<T>(
  permission: Permission,
  operation: (tx: Transaction, actor: Principal) => Promise<T>,
  changesIdentity = false,
): Promise<T> {
  const identity = await requireIdentity();
  return databaseOperation(() =>
    getDatabase().transaction(async (tx) => {
      await tx.execute(
        changesIdentity
          ? sql`select pg_advisory_xact_lock(${identityLock})`
          : sql`select pg_advisory_xact_lock_shared(${identityLock})`,
      );
      const actor = await loadPrincipal(tx, identity);
      assertPermission(actor, permission);
      return operation(tx, actor);
    }),
  );
}
