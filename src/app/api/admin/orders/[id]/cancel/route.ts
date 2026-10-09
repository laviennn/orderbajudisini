import { invalidateInventory } from "@/server/services/catalog-cache";
import { z } from "zod";
import { adminResponse } from "@/server/http/admin";
import { cancelOrder } from "@/server/services/admin-orders";
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return adminResponse(request, async (body) => {
    z.object({}).strict().parse(body);
    const result = await cancelOrder((await params).id);
    invalidateInventory();
    return result;
  });
}
