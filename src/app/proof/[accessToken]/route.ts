import { NextRequest, NextResponse } from "next/server";
import { resolveProofUrl } from "@/server/services/payments";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> },
) {
  try {
    const { accessToken } = await params;
    const { url } = await resolveProofUrl(accessToken);
    return NextResponse.redirect(url, 307);
  } catch {
    // If not found or invalid token, just return a 404 or 401.
    // To avoid enumerating errors, return 404.
    return new NextResponse("Not Found", { status: 404 });
  }
}
