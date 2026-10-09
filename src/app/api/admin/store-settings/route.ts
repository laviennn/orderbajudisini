import { revalidateTag } from "next/cache";
import { adminResponse } from "@/server/http/admin";
import { setStoreSettings } from "@/server/services/settings";
export async function POST(request: Request) {
  return adminResponse(request, async (body) => {
    const result = await setStoreSettings(body);
    revalidateTag("storefront", { expire: 0 });
    return result;
  });
}
