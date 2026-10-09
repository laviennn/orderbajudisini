import { z } from "zod";
import { revalidateTag } from "next/cache";
import { adminResponse } from "@/server/http/admin";
import {
  listBanners,
  saveBanner,
  deleteBanner,
} from "@/server/services/banners";
export async function GET(request: Request) {
  return adminResponse(request, () => listBanners());
}
export async function POST(request: Request) {
  return adminResponse(request, async (body) => {
    const { action, data } = z
      .object({ action: z.enum(["save", "delete"]), data: z.unknown() })
      .strict()
      .parse(body);
    const result =
      action === "save" ? await saveBanner(data) : await deleteBanner(data);
    revalidateTag("storefront", { expire: 0 });
    return result;
  });
}
