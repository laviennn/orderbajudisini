import { adminResponse } from "@/server/http/admin";
import { adminProduct } from "@/server/services/admin-products";
export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return adminResponse(request, async () => adminProduct((await params).id));
}
