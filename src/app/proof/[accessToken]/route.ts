import { NextRequest, NextResponse } from "next/server";
import { resolveProofFile, resolveProofUrl } from "@/server/services/payments";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> },
) {
  try {
    const { accessToken } = await params;
    const token = accessToken?.trim();

    // 1. Try directly streaming the proof image so it opens seamlessly on any mobile/desktop browser without 3rd party redirect issues
    try {
      const file = await resolveProofFile(token);
      return new NextResponse(new Uint8Array(file.buffer), {
        status: 200,
        headers: {
          "Content-Type": file.mime,
          "Content-Disposition": "inline",
          "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      });
    } catch {
      // 2. Fallback to presigned URL (now with inline Content-Disposition) if direct streaming cannot be completed
      const { url } = await resolveProofUrl(token);
      return NextResponse.redirect(url, 307);
    }
  } catch {
    // If not found or invalid token, return 404
    return new NextResponse("Not Found", { status: 404 });
  }
}

