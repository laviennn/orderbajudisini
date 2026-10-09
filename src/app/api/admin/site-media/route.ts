import { z } from "zod";
import { adminResponse } from "@/server/http/admin";
import { withStaff } from "@/server/auth/authorize";
import { getStorage } from "@/server/storage/r2";
import { uploadSchema } from "@/server/storage/policy";
import { validateSiteImage } from "@/server/services/site-media";
export async function POST(request: Request) {
  return adminResponse(request, async (body) => {
    const input = z
      .object({
        scope: z.enum(["banner", "store"]),
        action: z.enum(["authorize", "complete"]),
        data: z.unknown(),
      })
      .strict()
      .parse(body);
    return withStaff(
      input.scope === "banner" ? "content.write" : "settings.manage",
      async () => {
        if (input.action === "authorize") {
          const data = z
            .object({ mime: z.string(), bytes: z.number() })
            .strict()
            .parse(input.data);
          return getStorage().createUpload(
            uploadSchema.parse({ ...data, purpose: "site-media" }),
          );
        }
        const { key } = z
          .object({ key: z.string().max(200) })
          .strict()
          .parse(input.data);
        return { key, url: await validateSiteImage(key) };
      },
    );
  });
}
