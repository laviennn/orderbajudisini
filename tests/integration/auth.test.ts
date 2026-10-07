import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Auth } from "@auth/core";
import type { AuthConfig } from "@auth/core";
import { eq, sql } from "drizzle-orm";
import type { Database } from "@/server/db/operations";
import { startTestDatabase } from "./database";
let db: Database;
vi.mock("@/server/db", () => ({ getDatabase: () => db }));
import { bootstrapOwner } from "@/server/services/bootstrap";
import { staffAuthConfig } from "@/server/auth/config";
import { loadPrincipal } from "@/server/auth/principal";
import { users } from "@/server/db/schema";
let instance: Awaited<ReturnType<typeof startTestDatabase>>;
let ownerId: string;
let cookie: string;
const password = "TEST-ONLY-AUTH-password-2026!";
const origin = "https://localhost";
const config = () =>
  ({
    ...staffAuthConfig(),
    trustHost: true,
    basePath: "/api/auth",
  }) as AuthConfig;
beforeAll(async () => {
  instance = await startTestDatabase();
  db = instance.db;
  vi.stubEnv("AUTH_ENABLED", "true");
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-".repeat(4));
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/test-only-not-used");
  ownerId = (
    await bootstrapOwner(db, {
      name: "TEST AUTH OWNER",
      email: "auth@example.test",
      password,
    })
  ).id;
});
afterAll(async () => {
  await instance?.stop();
  vi.unstubAllEnvs();
});
async function login(pass: string, csrf = true) {
  const response = await Auth(new Request(`${origin}/api/auth/csrf`), config());
  const { csrfToken } = (await response.json()) as { csrfToken: string };
  const cookies = response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  return Auth(
    new Request(`${origin}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        cookie: cookies,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        csrfToken: csrf ? csrfToken : "invalid",
        email: "auth@example.test",
        password: pass,
        callbackUrl: `${origin}/admin`,
      }),
    }),
    config(),
  );
}
describe("Auth.js real credentials/session boundary", () => {
  it("requires CSRF and never creates a session for a wrong password", async () => {
    for (const [pass, csrf] of [
      [password, false],
      ["wrong", true],
    ] as const) {
      const response = await login(pass, csrf);
      expect(
        response.headers
          .getSetCookie()
          .some((c) => c.includes("session-token=")),
      ).toBe(false);
      expect(response.headers.get("location")).toMatch(/error=/);
    }
  });
  it("issues a secure HTTP-only session without password hashes", async () => {
    const response = await login(password);
    expect(response.headers.get("location")).toBe(`${origin}/admin`);
    const issued = response.headers
      .getSetCookie()
      .find((c) => c.includes("session-token="));
    expect(issued).toContain("HttpOnly");
    expect(issued).toContain("Secure");
    expect(issued).toContain("SameSite=Lax");
    cookie = issued!.split(";")[0]!;
    const sessionResponse = await Auth(
      new Request(`${origin}/api/auth/session`, { headers: { cookie } }),
      config(),
    );
    const session = await sessionResponse.json();
    expect(session.user.id).toBe(ownerId);
    expect(session.user.sessionVersion).toBe(0);
    expect(JSON.stringify(session)).not.toContain("scrypt$");
    expect(JSON.stringify(session)).not.toContain(password);
    expect((await loadPrincipal(db, session.user)).permissions).toContain(
      "operators.manage",
    );
  });
  it("rejects revoked identity even while an old signed session cookie exists", async () => {
    await db
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, ownerId));
    const response = await Auth(
      new Request(`${origin}/api/auth/session`, { headers: { cookie } }),
      config(),
    );
    const session = await response.json();
    await expect(loadPrincipal(db, session.user)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
});
