import { NextRequest, NextResponse } from "next/server";
import { getAdminPaymentProofUrl } from "@/server/services/admin-payments";
import { toApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { url } = await getAdminPaymentProofUrl(id);
    return NextResponse.redirect(url);
  } catch (error) {
    const apiError = toApiError(error);
    const status = apiError.code === "UNAUTHENTICATED" ? 401 : apiError.code === "FORBIDDEN" ? 403 : apiError.code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json(apiError, { status });
  }
}
