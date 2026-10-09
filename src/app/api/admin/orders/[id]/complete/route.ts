import { z } from "zod";
import { adminResponse } from "@/server/http/admin";
import { completeOrder } from "@/server/services/admin-orders";
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return adminResponse(request, async (body) => {
    z.object({}).strict().parse(body);
    return completeOrder((await params).id);
  });
}
