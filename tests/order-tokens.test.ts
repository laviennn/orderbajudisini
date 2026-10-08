import { expect, it } from "vitest";
import {
  createOrderToken,
  recoverOrderToken,
} from "@/server/services/order-tokens";
it("creates independent random capabilities and recovers only with the correct secret/order", () => {
  const secret = "TEST-only-order-envelope-secret";
  const a = createOrderToken(secret, "order-a");
  const b = createOrderToken(secret, "order-a");
  expect(a.token).toMatch(/^[a-f0-9]{64}$/);
  expect(a.token).not.toBe(b.token);
  expect(a.ciphertext).not.toContain(a.token);
  expect(recoverOrderToken(a.ciphertext, secret, "order-a")).toBe(a.token);
  expect(() => recoverOrderToken(a.ciphertext, secret, "order-b")).toThrow();
  expect(() => recoverOrderToken(a.ciphertext, "wrong", "order-a")).toThrow();
  const tampered =
    a.ciphertext.slice(0, -1) + (a.ciphertext.endsWith("0") ? "1" : "0");
  expect(() => recoverOrderToken(tampered, secret, "order-a")).toThrow();
});
