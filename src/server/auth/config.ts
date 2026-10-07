import "server-only";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getEnvironment } from "@/server/env";
import { authenticateCredentials } from "./credentials";
export function authenticationEnabled() {
  const env = getEnvironment();
  return (
    env.AUTH_ENABLED === "true" && Boolean(env.AUTH_SECRET && env.DATABASE_URL)
  );
}
export const staffAuthConfig = (): NextAuthConfig => ({
  secret: getEnvironment().AUTH_SECRET,
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      authorize: (input, request) =>
        authenticationEnabled()
          ? authenticateCredentials(input, request)
          : null,
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/admin/login", error: "/admin/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.sessionVersion =
          typeof token.sessionVersion === "number" ? token.sessionVersion : -1;
      }
      return session;
    },
  },
  logger: {
    error: () => console.error({ event: "authentication_error" }),
    warn: () => console.warn({ event: "authentication_warning" }),
  },
});
