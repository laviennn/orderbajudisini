import "server-only";
import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Database } from "@/server/db/operations";
import { loginRateLimits } from "@/server/db/schema";
export async function allowLogin(
  db: Database,
  email: string,
  network: string,
  secret: string,
): Promise<boolean> {
  const hash = (value: string) =>
    createHmac("sha256", secret).update(value).digest("hex");
  const consume = async (key: string, limit: number) => {
    const [row] = await db
      .insert(loginRateLimits)
      .values({
        key,
        attempts: 1,
        expiresAt: sql`now() + interval '15 minutes'`,
      })
      .onConflictDoUpdate({
        target: loginRateLimits.key,
        set: {
          attempts: sql`case when ${loginRateLimits.expiresAt} <= now() then 1 else least(${loginRateLimits.attempts} + 1, 1000000) end`,
          expiresAt: sql`case when ${loginRateLimits.expiresAt} <= now() then now() + interval '15 minutes' else ${loginRateLimits.expiresAt} end`,
        },
      })
      .returning({ attempts: loginRateLimits.attempts });
    return Boolean(row && row.attempts <= limit);
  };
  // Consume both even when one is exhausted, without resetting counters on successful login.
  const networkAllowed = await consume(hash(`network:${network}`), 30);
  if (!networkAllowed) return false;
  return consume(hash(`email:${email}`), 5);
}
