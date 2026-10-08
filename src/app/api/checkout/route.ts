import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { apiResponse } from "@/server/http/api";
import { getDatabase } from "@/server/db";
import { loginRateLimits } from "@/server/db/schema";
import { getEnvironment } from "@/server/env";
import { AppError } from "@/lib/errors";
import { prepareCheckout, submitCheckout } from "@/server/services/checkout";
export async function POST(request: Request) {
  return apiResponse(request,async input=>{
    const {action,data} = z.object({action:z.enum(["prepare","submit"]),data:z.unknown()}).strict().parse(input);
    const secret = getEnvironment().AUTH_SECRET;
    if (!secret) throw new AppError("NOT_CONFIGURED");
    // Vercel overwrites this header. Other deployments share one conservative bucket
    // until their trusted proxy is explicitly configured; never trust arbitrary XFF.
    const network = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for") ?? "unknown" : "local";
    const key = createHmac("sha256",secret).update(`checkout:${network}`).digest("hex");
    const [limit] = await getDatabase().insert(loginRateLimits).values({key,attempts:1,expiresAt:sql`now() + interval '15 minutes'`}).onConflictDoUpdate({target:loginRateLimits.key,set:{attempts:sql`case when ${loginRateLimits.expiresAt} <= now() then 1 else least(${loginRateLimits.attempts}+1,1000000) end`,expiresAt:sql`case when ${loginRateLimits.expiresAt} <= now() then now()+interval '15 minutes' else ${loginRateLimits.expiresAt} end`}}).returning({attempts:loginRateLimits.attempts});
    if (!limit || limit.attempts>60) throw new AppError("RATE_LIMITED");
    return action === "prepare" ? prepareCheckout(data) : submitCheckout(data);
  });
}
