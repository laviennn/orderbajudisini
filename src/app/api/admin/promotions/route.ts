import { z } from "zod";
import { adminResponse } from "@/server/http/admin";
import {
  savePromotion,
  previewPromotionPricing,
  promotionProductSearch,
  setProductPromotionEligibility,
} from "@/server/services/promotions";
import { invalidateInventory } from "@/server/services/catalog-cache";
export function POST(request: Request) {
  return adminResponse(request, async (body) => {
    const { action, data } = z
      .object({
        action: z.enum(["save", "preview", "search", "eligibility"]),
        data: z.unknown(),
      })
      .strict()
      .parse(body);
    if (action === "search") return promotionProductSearch(data);
    if (action === "preview") return previewPromotionPricing(data);
    if (action === "eligibility") {
      const result = await setProductPromotionEligibility(data);
      invalidateInventory();
      return result;
    }
    const parsed = z
      .object({
        startsAt: z.iso.datetime().nullable(),
        endsAt: z.iso.datetime().nullable(),
      })
      .passthrough()
      .parse(data);
    const result = await savePromotion({
      ...parsed,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : null,
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
    });
    invalidateInventory();
    return result;
  });
}
