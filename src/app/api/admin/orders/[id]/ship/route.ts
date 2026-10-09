import { z } from "zod";
import { adminResponse } from "@/server/http/admin";
import { shipOrder } from "@/server/services/admin-orders";
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return adminResponse(request, async (body) => {
    const data = z
      .object({
        courier: z.string().trim().min(1).max(100),
        service: z.string().trim().min(1).max(100),
        trackingNumber: z.string().trim().min(1).max(120),
      })
      .strict()
      .parse(body);
    return shipOrder((await params).id, data);
  });
}
