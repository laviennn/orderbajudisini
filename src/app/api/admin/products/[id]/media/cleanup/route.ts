import { adminResponse } from "@/server/http/admin";
import { cleanupProductMedia } from "@/server/services/admin-media";
export const maxDuration = 60;
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return adminResponse(request, async () =>
    cleanupProductMedia((await params).id),
  );
}
