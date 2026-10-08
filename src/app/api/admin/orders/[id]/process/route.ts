import { NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import { processOrder } from "@/server/services/admin-orders";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (req.method !== "POST") throw new AppError("FORBIDDEN");
  const { id } = await params;
  const updated = await processOrder(id);
  return NextResponse.json(updated);
}
