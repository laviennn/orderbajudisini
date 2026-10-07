import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/server/db";
import { users } from "@/server/db/schema";
import { getEnvironment } from "@/server/env";
import { allowLogin } from "./rate-limit";
import { verifyPassword } from "./password";
export const emailSchema = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());
const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export async function authenticateCredentials(
  input: unknown,
  request: Request,
) {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return null;
  const env = getEnvironment();
  if (!env.AUTH_SECRET) return null;
  try {
    const db = getDatabase();
    // Only Vercel's overwritten header is trusted. Elsewhere use a shared conservative bucket.
    const network =
      process.env.VERCEL === "1"
        ? (request.headers.get("x-vercel-forwarded-for") ?? "unknown").slice(
            0,
            100,
          )
        : "local";
    if (!(await allowLogin(db, parsed.data.email, network, env.AUTH_SECRET)))
      return null;
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        passwordHash: users.passwordHash,
        status: users.status,
        sessionVersion: users.sessionVersion,
      })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);
    const valid = await verifyPassword(
      parsed.data.password,
      user?.passwordHash ?? null,
    );
    if (!valid || !user || user.status !== "active") return null;
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      sessionVersion: user.sessionVersion,
    };
  } catch {
    console.error({ event: "staff_login_unavailable" });
    return null;
  }
}
