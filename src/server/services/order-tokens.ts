import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { AppError } from "@/lib/errors";

const key = (secret: string) =>
  createHash("sha256")
    .update("order-token-envelope:v1:")
    .update(secret)
    .digest();
// The hash remains the access verifier. This authenticated envelope exists only so a
// committed order can return the SAME random capability after a lost-response retry.
export function createOrderToken(secret: string, orderId: string) {
  const bytes = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(orderId));
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return {
    token: bytes.toString("hex"),
    ciphertext: `v1.${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${encrypted.toString("hex")}`,
  };
}
export function recoverOrderToken(
  ciphertext: string,
  secret: string,
  orderId: string,
) {
  try {
    if (!/^v1\.[a-f0-9]{24}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(ciphertext))
      throw new Error("Invalid envelope");
    const [, iv, tag, encrypted] = ciphertext.split(".");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key(secret),
      Buffer.from(iv!, "hex"),
    );
    cipher.setAAD(Buffer.from(orderId));
    cipher.setAuthTag(Buffer.from(tag!, "hex"));
    return Buffer.concat([
      cipher.update(Buffer.from(encrypted!, "hex")),
      cipher.final(),
    ]).toString("hex");
  } catch {
    throw new AppError("CONFLICT");
  }
}
