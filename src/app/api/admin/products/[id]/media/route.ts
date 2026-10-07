import { adminResponse } from "@/server/http/admin";
import {
  changeProductMedia,
  cleanupProductMedia,
} from "@/server/services/admin-media";
import { invalidateProduct } from "@/server/services/catalog-cache";
import { z } from "zod";
export const maxDuration = 60;
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return adminResponse(request, async (input) => {
    const data = z.record(z.string(), z.unknown()).parse(input);
    const productId = (await params).id;
    const result = await changeProductMedia({ ...data, productId });
    invalidateProduct(result.slug);
    let cleanup = null;
    if (data.action === "remove") {
      try {
        cleanup = await cleanupProductMedia(productId);
      } catch {
        // Detachment has committed. Configuration/auth/provider failure during this
        // separate cleanup attempt must not misreport the already-completed removal.
        cleanup = { failed: 1, cleaned: 0 };
      }
    }
    return { ...result, cleanup };
  });
}
