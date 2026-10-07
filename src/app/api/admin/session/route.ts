import { randomUUID } from "node:crypto";
import { requirePermission } from "@/server/auth/authorize";
import { toApiError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await requirePermission("admin.access");
    return Response.json(
      { user: { id: user.id, permissions: user.permissions } },
      { headers },
    );
  } catch (error) {
    const safe = toApiError(error, randomUUID());
    const status =
      safe.code === "UNAUTHENTICATED"
        ? 401
        : safe.code === "FORBIDDEN"
          ? 403
          : 503;
    return Response.json({ error: safe }, { status, headers });
  }
}
