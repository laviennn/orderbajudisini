import { NextRequest } from "next/server";
import { verifyPayment } from "@/server/services/payments";
import { apiResponse } from "@/server/http/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return apiResponse(request, async () => {
    return verifyPayment(id);
  });
}
