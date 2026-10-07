import { describe, expect, it } from "vitest";
import { canTransitionOrder, canTransitionPayment } from "@/lib/domain/states";
import {
  defaultRoles,
  hasPermission,
  permissionKeys,
  assertPermission,
} from "@/server/auth/policy";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { reviewInput } from "@/server/repositories/reviews";
describe("domain rules", () => {
  it("gives owners all permissions and restricts operator roles", () => {
    const principal = (permissions: readonly string[]) => ({
      id: "test",
      status: "active" as const,
      permissions,
    });
    for (const key of permissionKeys)
      expect(hasPermission(principal(defaultRoles.Owner), key)).toBe(true);
    expect(() =>
      assertPermission(
        principal(defaultRoles["Catalog Operator"]),
        "operators.manage",
      ),
    ).toThrow();
    expect(() =>
      assertPermission(
        principal(defaultRoles["Catalog Operator"]),
        "payments.verify",
      ),
    ).toThrow();
    expect(
      hasPermission(
        principal(defaultRoles["Order Operator"]),
        "products.publish",
      ),
    ).toBe(false);
    expect(
      hasPermission(
        principal([...defaultRoles["Order Operator"], "products.publish"]),
        "products.publish",
      ),
    ).toBe(true);
  });
  it("allows only documented order transitions", () => {
    expect(canTransitionOrder("pending_payment", "payment_submitted")).toBe(
      true,
    );
    expect(canTransitionOrder("pending_payment", "shipped")).toBe(false);
    expect(canTransitionOrder("completed", "pending_payment")).toBe(false);
    expect(canTransitionOrder("payment_submitted", "pending_payment")).toBe(
      true,
    );
  });
  it("requires separate proof submission and verification", () => {
    expect(canTransitionPayment("pending", "submitted")).toBe(true);
    expect(canTransitionPayment("pending", "verified")).toBe(false);
    expect(canTransitionPayment("submitted", "verified")).toBe(true);
    expect(canTransitionPayment("verified", "rejected")).toBe(false);
  });
  it("validates review rating range", () => {
    const input = {
      productId: "aa9297b0-cd6d-4e13-9580-e981d0f23d98",
      reviewerName: "TEST review",
      body: "TEST content",
    };
    for (const rating of [0, 6, 1.5])
      expect(reviewInput.safeParse({ ...input, rating }).success).toBe(false);
    expect(reviewInput.safeParse({ ...input, rating: 5 }).success).toBe(true);
  });
  it("salts passwords, verifies securely, and rejects malformed hashes", async () => {
    const password = "TEST-only password 2026!";
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    expect(await hashPassword(password)).not.toBe(hash);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword(password, null)).toBe(false);
    expect(await verifyPassword(password, "invalid")).toBe(false);
  });
});
