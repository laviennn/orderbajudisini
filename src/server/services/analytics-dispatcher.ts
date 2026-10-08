import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/server/db";
import { analyticsOutbox } from "@/server/db/schema";
import { getEnvironment } from "@/server/env";

export async function dispatchAnalyticsEvents() {
  const env = getEnvironment();
  if (!env.GA4_MEASUREMENT_ID || !env.GA4_API_SECRET) {
    console.log("[Analytics] Skipping dispatch: GA4_MEASUREMENT_ID or GA4_API_SECRET not configured.");
    return { dispatched: 0, failed: 0 };
  }

  const batchSize = 50;

  const db = getDatabase();

  // 1. Fetch pending events
  const pendingEvents = await db
    .select()
    .from(analyticsOutbox)
    .where(inArray(analyticsOutbox.status, ["pending", "failed"]))
    .limit(batchSize);

  if (pendingEvents.length === 0) {
    return { dispatched: 0, failed: 0 };
  }

  // 2. Mark as processing (simple concurrency control if multiple workers)
  const eventIds = pendingEvents.map((e) => e.id);
  await db
    .update(analyticsOutbox)
    .set({ status: "processing", updatedAt: new Date() })
    .where(inArray(analyticsOutbox.id, eventIds));

  let dispatchedCount = 0;
  let failedCount = 0;
  const successfulIds: string[] = [];
  const failedUpdates: { id: string; error: string }[] = [];

  // 3. Dispatch to GA4 Measurement Protocol
  for (const event of pendingEvents) {
    try {
      const payload = {
        client_id: event.orderId, // Use order ID as a consistent server-side pseudo client ID since no PII/cookie is kept
        events: [
          {
            name: event.eventType,
            params: event.payload,
          }
        ]
      };

      const res = await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`GA4 API error: ${res.status} ${res.statusText} - ${errorText}`);
      }

      successfulIds.push(event.id);
      dispatchedCount++;
    } catch (error) {
      console.error(`[Analytics] Failed to dispatch event ${event.id}:`, error);
      failedUpdates.push({
        id: event.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      failedCount++;
    }
  }

  // 4. Cleanup and update status
  if (successfulIds.length > 0) {
    await db.delete(analyticsOutbox).where(inArray(analyticsOutbox.id, successfulIds));
  }

  for (const failure of failedUpdates) {
    await db
      .update(analyticsOutbox)
      .set({ status: "failed", error: failure.error, updatedAt: new Date() })
      .where(eq(analyticsOutbox.id, failure.id));
  }

  return { dispatched: dispatchedCount, failed: failedCount };
}
