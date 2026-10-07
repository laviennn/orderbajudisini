import { adminResponse } from "@/server/http/admin";
import { changeProductStatus } from "@/server/services/admin-products";
import { invalidateProduct } from "@/server/services/catalog-cache";
import { z } from "zod";
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return adminResponse(request, async (input) => {
    const body = z
      .object({
        action: z.enum(["publish", "draft", "archive"]),
        updatedAt: z.iso.datetime(),
      })
      .strict()
      .parse(input);
    const p = await changeProductStatus({ ...body, id: (await params).id });
    invalidateProduct(p.slug);
    return p;
  });
}
