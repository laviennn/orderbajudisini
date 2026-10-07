import { adminResponse } from "@/server/http/admin";
import { saveCategory } from "@/server/services/admin-products";
import { invalidateCategories } from "@/server/services/catalog-cache";
export function POST(request: Request) {
  return adminResponse(request, async (input) => {
    const row = await saveCategory(input);
    invalidateCategories();
    return row;
  });
}
