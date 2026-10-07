import { adminResponse } from "@/server/http/admin";
import { saveProduct } from "@/server/services/admin-products";
import { invalidateProduct } from "@/server/services/catalog-cache";
export function POST(request: Request) {
  return adminResponse(request, async (input) => {
    const p = await saveProduct(input);
    invalidateProduct(p.slug, p.previousSlug);
    return p;
  });
}
