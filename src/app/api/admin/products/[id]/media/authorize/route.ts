import { adminResponse } from "@/server/http/admin";
import { authorizeProductUpload } from "@/server/services/admin-media";
import { z } from "zod";
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return adminResponse(request, async (input) => {
    const body = z
      .object({
        mime: z.string(),
        bytes: z.number(),
        altText: z.string(),
        isDefectImage: z.boolean(),
      })
      .strict()
      .parse(input);
    return authorizeProductUpload({ ...body, productId: (await params).id });
  });
}
