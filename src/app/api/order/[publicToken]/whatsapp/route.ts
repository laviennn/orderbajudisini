import { NextRequest, NextResponse } from "next/server";
import { generateWhatsAppConfirmationUrl } from "@/server/services/whatsapp";
import { AppError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  try {
    const { publicToken } = await params;
    const url = await generateWhatsAppConfirmationUrl(publicToken);

    return NextResponse.json(
      { url },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "NOT_FOUND") {
        return new NextResponse("Tidak Ditemukan", { status: 404 });
      }
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
