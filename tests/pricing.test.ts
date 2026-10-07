import { describe, expect, it } from "vitest";
import {
  calculateCartPricing,
  type PricedProduct,
  type PromotionRule,
} from "@/lib/domain/pricing";
import { formatIdr, sumMoney } from "@/lib/domain/money";
const now = new Date("2026-01-01T00:00:00Z");
const promotion: PromotionRule = {
  id: "bundle-test",
  name: "TEST 3 Items Rp100K",
  requiredQuantity: 3,
  bundlePrice: 100000,
  active: true,
  startsAt: null,
  endsAt: null,
  priority: 0,
  categoryId: null,
  allocationStrategy: "highest_price_first",
  pricePolicy: "discount_only",
};
const products = (count: number): PricedProduct[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `test-${i}`,
    price: 45000,
    quantity: 1,
    promotionEligible: true,
    categoryId: "test-category",
  }));
describe("integer IDR bundle pricing", () => {
  it.each([
    [1, 45000],
    [2, 90000],
    [3, 100000],
    [4, 145000],
    [5, 190000],
    [6, 200000],
    [7, 245000],
    [8, 290000],
    [9, 300000],
  ])("%i eligible products total %i", (count, total) => {
    const result = calculateCartPricing(products(count), [promotion], now);
    expect(result.merchandiseTotal).toBe(total);
    expect(
      result.originalSubtotal -
        result.promotionDiscount +
        result.promotionSurcharge,
    ).toBe(total);
    expect(result.lines.reduce((s, l) => s + l.total, 0)).toBe(total);
    expect(
      result.appliedPromotions.reduce((s, p) => s + p.bundleCount, 0),
    ).toBe(Math.floor(count / 3));
  });
  it.each([
    [2, 135000],
    [3, 145000],
  ])("%i eligible plus one ineligible", (eligible, total) => {
    const items = products(eligible + 1);
    items[eligible]!.promotionEligible = false;
    expect(calculateCartPricing(items, [promotion], now).merchandiseTotal).toBe(
      total,
    );
  });
  it("implements both explicit remainder strategies and ignores input ordering", () => {
    const items = products(4).map((p, i) => ({
      ...p,
      price: [60000, 50000, 45000, 40000][i]!,
    }));
    const result = calculateCartPricing(items, [promotion], now);
    expect(result.merchandiseTotal).toBe(140000);
    expect(
      calculateCartPricing([...items].reverse(), [promotion], now),
    ).toEqual(result);
    expect(
      calculateCartPricing(
        items,
        [{ ...promotion, allocationStrategy: "lowest_price_first" }],
        now,
      ).merchandiseTotal,
    ).toBe(160000);
  });
  it("does not enable an unresolved active promotion", () => {
    expect(() =>
      calculateCartPricing(
        products(3),
        [{ ...promotion, allocationStrategy: null }],
        now,
      ),
    ).toThrow();
  });
  it("respects explicit cheaper-normal versus fixed-price policy", () => {
    const items = products(3).map((p) => ({ ...p, price: 20000 }));
    expect(calculateCartPricing(items, [promotion], now).merchandiseTotal).toBe(
      60000,
    );
    const fixed = calculateCartPricing(
      items,
      [{ ...promotion, pricePolicy: "fixed_bundle" }],
      now,
    );
    expect(fixed.merchandiseTotal).toBe(100000);
    expect(fixed.promotionSurcharge).toBe(40000);
  });
  it("respects schedules, category scope and inactive campaigns", () => {
    for (const rule of [
      { ...promotion, active: false },
      { ...promotion, endsAt: now },
      { ...promotion, startsAt: new Date(now.getTime() + 1) },
      { ...promotion, categoryId: "other" },
      { ...promotion, productIds: ["test-0"] },
    ])
      expect(
        calculateCartPricing(products(3), [rule], now).merchandiseTotal,
      ).toBe(135000);
  });
  it("supports quantities, other bundle sizes, deterministic priority, and no double-discount", () => {
    const p = products(1);
    p[0]!.quantity = 6;
    expect(
      calculateCartPricing(
        p,
        [promotion, { ...promotion, id: "second", priority: -1 }],
        now,
      ).merchandiseTotal,
    ).toBe(200000);
    expect(
      calculateCartPricing(
        products(4),
        [{ ...promotion, requiredQuantity: 4, bundlePrice: 120000 }],
        now,
      ).merchandiseTotal,
    ).toBe(120000);
  });
  it("rejects duplicate lines, fractional IDR and unsafe overflow", () => {
    expect(() =>
      calculateCartPricing(
        [products(1)[0]!, products(1)[0]!],
        [promotion],
        now,
      ),
    ).toThrow();
    expect(() =>
      calculateCartPricing([{ ...products(1)[0]!, price: 0.5 }], [], now),
    ).toThrow();
    expect(() => sumMoney([Number.MAX_SAFE_INTEGER, 1])).toThrow();
    expect(formatIdr(185000)).toContain("185.000");
  });
});

it("does not discount noneligible products or let interleaving break bundles", () => {
  const ineligible = products(3).map((p) => ({
    ...p,
    promotionEligible: false,
  }));
  expect(
    calculateCartPricing(ineligible, [promotion], now).merchandiseTotal,
  ).toBe(135000);
  const mixed = products(5).map((p, i) => ({
    ...p,
    promotionEligible: i % 2 === 0,
  }));
  expect(calculateCartPricing(mixed, [promotion], now).merchandiseTotal).toBe(
    190000,
  );
});
