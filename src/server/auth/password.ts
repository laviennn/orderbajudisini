import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export const passwordSchema = z.string().min(15).max(128);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, options, (error, result) =>
      error ? reject(error) : resolve(result),
    ),
  );
}
export async function hashPassword(password: string) {
  passwordSchema.parse(password);
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt);
  return `scrypt$32768$8$3$${salt}$${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string | null) {
  const match = encoded?.match(
    /^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{128})$/,
  );
  // Always perform a KDF, including missing/inactive users, to reduce account enumeration.
  const actual = await derive(
    password.slice(0, 128),
    match?.[1] ?? "0".repeat(32),
  );
  const expected = Buffer.from(match?.[2] ?? "0".repeat(128), "hex");
  return (
    timingSafeEqual(actual, expected) &&
    Boolean(match) &&
    password.length <= 128
  );
}
