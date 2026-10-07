import "server-only";
import NextAuth from "next-auth";
import { staffAuthConfig } from "./config";
export { authenticationEnabled } from "./config";
export const { auth, handlers, signIn, signOut } = NextAuth(staffAuthConfig);
