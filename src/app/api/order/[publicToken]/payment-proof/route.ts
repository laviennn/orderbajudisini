import { NextRequest, NextResponse } from "next/server";
import { uploadPaymentProofDirect } from "@/server/services/payments";
import { AppError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  try {
    const { publicToken } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "File bukti pembayaran wajib diunggah.",
        },
        { status: 400 },
      );
    }

    const mime = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadPaymentProofDirect(publicToken, buffer, mime);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Kesalahan server saat mengunggah bukti pembayaran.",
      },
      { status: 500 },
    );
  }
}
