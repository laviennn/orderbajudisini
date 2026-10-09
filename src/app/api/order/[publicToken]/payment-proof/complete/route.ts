import { NextRequest, NextResponse } from "next/server";
import { completeProofUpload } from "@/server/services/payments";
import { AppError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  try {
    const { publicToken } = await params;
    const body = await request.json();
    const result = await completeProofUpload(publicToken, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Kesalahan server." },
      { status: 500 },
    );
  }
}
