import { NextRequest, NextResponse } from "next/server";
import { publicOrder } from "@/server/services/checkout";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ publicToken: string }> },
) {
  try {
    const { publicToken } = await params;
    const token = publicToken?.trim();
    if (!token) {
      return new NextResponse("Token tidak valid", { status: 400 });
    }

    const order = await publicOrder(token);
    if (!order || !order.qris?.imageUrl) {
      return new NextResponse("QRIS tidak ditemukan", { status: 404 });
    }

    const response = await fetch(order.qris.imageUrl);
    if (!response.ok) {
      return new NextResponse("Gagal mengambil file QRIS", { status: 502 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/png";
    const safeOrder = order.orderNumber ? `-${order.orderNumber}` : "";
    const safeMerchant = order.qris.merchantName
      ? `-${order.qris.merchantName.trim().replace(/[^a-zA-Z0-9_-]/g, "_")}`
      : "";
    const filename = `QRIS${safeMerchant}${safeOrder}.png`;

    return new NextResponse(new Uint8Array(arrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Terjadi kesalahan sistem", { status: 500 });
  }
}
