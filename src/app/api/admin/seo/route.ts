import { revalidateTag } from "next/cache";
import { adminResponse } from "@/server/http/admin";
import {
  getAdminSeoSettings,
  updateSeoSettings,
} from "@/server/services/settings";
export async function GET(request: Request) {
  return adminResponse(request, () => getAdminSeoSettings());
}
export async function POST(request: Request) {
  return adminResponse(request, async (body) => {
    const result = await updateSeoSettings(body);
    revalidateTag("storefront", { expire: 0 });
    revalidateTag("sitemap", { expire: 0 });
    return result;
  });
}
