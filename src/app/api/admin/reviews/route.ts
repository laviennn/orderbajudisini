import { revalidateTag } from "next/cache";
import { adminResponse } from "@/server/http/admin";
import { moderateReview } from "@/server/services/reviews";
export function POST(request: Request) {
  return adminResponse(request, async (body) => {
    const result = await moderateReview(body);
    revalidateTag("reviews", { expire: 0 });
    return result;
  });
}
