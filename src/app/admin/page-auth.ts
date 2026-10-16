import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/authorize";
import type { Permission, Principal } from "@/server/auth/policy";
import { AppError } from "@/lib/errors";

export async function requirePagePermission(
  permission: Permission,
): Promise<Principal> {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (
      error instanceof AppError &&
      ["UNAUTHENTICATED", "NOT_CONFIGURED"].includes(error.code)
    ) {
      redirect("/admin/login");
    }
    throw error;
  }
}
