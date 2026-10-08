import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/authorize", () => ({
  withStaff: vi.fn(),
}));

vi.mock("@/server/env", () => ({
  getEnvironment: vi.fn(() => ({
    AUTH_SECRET: "test-secret-for-ticket-sealing",
  })),
}));
import { normalizePhone } from "../src/server/services/checkout";
import { AppError } from "../src/lib/errors";

describe("Checkout Utils", () => {
  describe("normalizePhone", () => {
    it("strips non-numeric characters and formats to +62", () => {
      expect(normalizePhone("0812-3456-7890")).toBe("+6281234567890");
      expect(normalizePhone("+62 812 3456 7890")).toBe("+6281234567890");
      expect(normalizePhone("6281234567890")).toBe("+6281234567890");
      expect(normalizePhone("(0812) 3456-7890")).toBe("+6281234567890");
    });

    it("throws VALIDATION_ERROR for invalid numbers", () => {
      expect(() => normalizePhone("081")).toThrow(AppError);
      expect(() => normalizePhone("0215551234")).toThrow(AppError);
      expect(() => normalizePhone("+1 555 1234567")).toThrow(AppError);
    });
  });

  describe("Ticket Sealing", () => {
    it("seals and opens a valid ticket securely", async () => {
      const { seal, open } = await import("../src/server/services/checkout");
      process.env.AUTH_SECRET = "test-secret-for-ticket-sealing";

      const ticket = {
        customerId: "cust-1",
        addressId: "addr-1",
        bankAccountId: "bank-1",
        items: [{ productId: "prod-1", quantity: 1 }],
        idempotencyKey: "idem-1",
        shippingQuoteId: "quote-1",
        merchandiseTotal: 100000,
        expires: Date.now() + 10000,
        notes: "test notes",
      };

      const sealed = seal(ticket);
      expect(typeof sealed).toBe("string");

      const opened = open(sealed);
      expect(opened).toEqual(ticket);
    });

    it("throws INVALID_SHIPPING_SELECTION on tampered ticket", async () => {
      const { seal, open } = await import("../src/server/services/checkout");
      process.env.AUTH_SECRET = "test-secret-for-ticket-sealing";

      const ticket = {
        customerId: "cust-1",
        addressId: "addr-1",
        bankAccountId: "bank-1",
        items: [{ productId: "prod-1", quantity: 1 }],
        idempotencyKey: "idem-1",
        shippingQuoteId: "quote-1",
        merchandiseTotal: 100000,
        expires: Date.now() + 10000,
      };

      const sealed = seal(ticket);
      const tampered =
        sealed.substring(0, 20) +
        (sealed[20] === "a" ? "b" : "a") +
        sealed.substring(21);

      expect(() => open(tampered)).toThrow(AppError);
    });

    it("throws on expired ticket", async () => {
      const { seal, open } = await import("../src/server/services/checkout");
      process.env.AUTH_SECRET = "test-secret-for-ticket-sealing";

      const ticket = {
        customerId: "cust-1",
        addressId: "addr-1",
        bankAccountId: "bank-1",
        items: [{ productId: "prod-1", quantity: 1 }],
        idempotencyKey: "idem-1",
        shippingQuoteId: "quote-1",
        merchandiseTotal: 100000,
        expires: Date.now() - 1000, // expired
      };

      const sealed = seal(ticket);

      expect(() => open(sealed)).toThrow(AppError);
    });
  });
});
