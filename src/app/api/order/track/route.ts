import { apiResponse } from "@/server/http/api";
import { findOrderForTracking } from "@/server/services/checkout";

export async function POST(request: Request) {
  return apiResponse(request, async (body) => {
    return findOrderForTracking(body);
  });
}
