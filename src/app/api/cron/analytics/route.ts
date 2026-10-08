import { NextResponse } from "next/server";
import { dispatchAnalyticsEvents } from "@/server/services/analytics-dispatcher";
import { getEnvironment } from "@/server/env";
import { timingSafeEqual } from "crypto";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const secret = getEnvironment().CRON_SECRET;
    
    if (!secret) {
      return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }
    
    const expectedAuth = `Bearer ${secret}`;
    
    if (!authHeader || authHeader.length !== expectedAuth.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dispatched, failed } = await dispatchAnalyticsEvents();
    
    return NextResponse.json({ success: true, dispatched, failed });
  } catch (error) {
    console.error("Analytics Dispatcher Cron Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
