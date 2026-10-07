import { adminResponse } from "@/server/http/admin";
import { completeProductUpload } from "@/server/services/admin-media";
import { invalidateProduct } from "@/server/services/catalog-cache";
import { z } from "zod";
export const maxDuration = 60;
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return adminResponse(request, async (input) => {
    const body = z.object({ uploadId: z.uuid() }).strict().parse(input);
    const result = await completeProductUpload({
      ...body,
      productId: (await params).id,
    });
    invalidateProduct(result.slug);
    return result;
  });
}
