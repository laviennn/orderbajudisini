import { z } from "zod";
import { adminResponse } from "@/server/http/admin";
import { rejectAdminPayment } from "@/server/services/admin-payments";
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return adminResponse(request, async (body) => {
    const data = z
      .object({ reason: z.string().trim().min(1).max(1000) })
      .strict()
      .parse(body);
    return rejectAdminPayment((await params).id, data.reason);
  });
}
