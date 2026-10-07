import { AppError } from "@/lib/errors";
import { money, multiplyMoney, sumMoney } from "./money";
export type PricedProduct = {
  id: string;
  price: number;
  quantity: number;
  promotionEligible: boolean;
  categoryId: string;
};
export type PromotionRule = {
  id: string;
  name: string;
  requiredQuantity: number;
  bundlePrice: number;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  priority: number;
  allocationStrategy: string | null;
  pricePolicy: string | null;
  categoryId: string | null;
  productIds?: readonly string[];
};
export type AppliedPromotion = {
  promotionId: string;
  name: string;
  requiredQuantity: number;
  bundlePrice: number;
  bundleCount: number;
  discountAmount: number;
  surchargeAmount: number;
  allocationStrategy: string;
  pricePolicy: string;
  allocations: { productId: string; quantity: number; total: number }[];
};
export type PricingResult = {
  originalSubtotal: number;
  promotionDiscount: number;
  promotionSurcharge: number;
  merchandiseTotal: number;
  lines: {
    productId: string;
    quantity: number;
    unitPrice: number;
    originalTotal: number;
    discount: number;
    surcharge: number;
    total: number;
  }[];
  appliedPromotions: AppliedPromotion[];
};
type Unit = {
  product: PricedProduct;
  index: number;
  total: number;
  used: boolean;
};
const key = (unit: Unit) =>
  `${unit.product.id}:${unit.index.toString().padStart(3, "0")}`;
function allocate(units: Unit[], total: number) {
  const original = sumMoney(units.map((u) => u.product.price));
  const denominator = BigInt(original || units.length);
  const pieces = units
    .map((unit) => {
      const numerator =
        BigInt(total) * BigInt(original ? unit.product.price : 1);
      return {
        unit,
        value: Number(numerator / denominator),
        remainder: numerator % denominator,
      };
    })
    .sort((a, b) =>
      a.remainder === b.remainder
        ? key(a.unit).localeCompare(key(b.unit))
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  const leftover = total - sumMoney(pieces.map((p) => p.value));
  pieces.forEach((p, i) => {
    p.unit.total = p.value + (i < leftover ? 1 : 0);
    p.unit.used = true;
  });
}
export function calculateCartPricing(
  products: readonly PricedProduct[],
  promotions: readonly PromotionRule[],
  now: Date,
): PricingResult {
  if (
    products.length === 0 ||
    new Set(products.map((p) => p.id)).size !== products.length
  )
    throw new AppError("VALIDATION_ERROR");
  const units: Unit[] = [];
  for (const product of products) {
    money(product.price);
    if (
      !Number.isInteger(product.quantity) ||
      product.quantity < 1 ||
      product.quantity > 100 ||
      units.length + product.quantity > 100
    )
      throw new AppError("VALIDATION_ERROR");
    for (let index = 0; index < product.quantity; index++)
      units.push({ product, index, total: product.price, used: false });
  }
  const appliedPromotions: AppliedPromotion[] = [];
  const active = promotions
    .filter(
      (p) =>
        p.active &&
        (!p.startsAt || p.startsAt <= now) &&
        (!p.endsAt || p.endsAt > now),
    )
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const rule of active) {
    if (
      !["highest_price_first", "lowest_price_first"].includes(
        rule.allocationStrategy ?? "",
      ) ||
      !["discount_only", "fixed_bundle"].includes(rule.pricePolicy ?? "")
    )
      throw new AppError("PRICING_NOT_CONFIGURED");
    if (
      !Number.isInteger(rule.requiredQuantity) ||
      rule.requiredQuantity < 2 ||
      rule.requiredQuantity > 100
    )
      throw new AppError("VALIDATION_ERROR");
    money(rule.bundlePrice);
    const eligible = units
      .filter(
        (u) =>
          !u.used &&
          u.product.promotionEligible &&
          (!rule.categoryId || u.product.categoryId === rule.categoryId) &&
          (!rule.productIds?.length || rule.productIds.includes(u.product.id)),
      )
      .sort(
        (a, b) =>
          (rule.allocationStrategy === "highest_price_first"
            ? b.product.price - a.product.price
            : a.product.price - b.product.price) ||
          key(a).localeCompare(key(b)),
      );
    const applied: AppliedPromotion = {
      promotionId: rule.id,
      name: rule.name,
      requiredQuantity: rule.requiredQuantity,
      bundlePrice: rule.bundlePrice,
      bundleCount: 0,
      discountAmount: 0,
      surchargeAmount: 0,
      allocationStrategy: rule.allocationStrategy!,
      pricePolicy: rule.pricePolicy!,
      allocations: [],
    };
    for (
      let i = 0;
      i + rule.requiredQuantity <= eligible.length;
      i += rule.requiredQuantity
    ) {
      const group = eligible.slice(i, i + rule.requiredQuantity);
      const original = sumMoney(group.map((u) => u.product.price));
      if (rule.pricePolicy === "discount_only" && original <= rule.bundlePrice)
        continue;
      allocate(group, rule.bundlePrice);
      applied.bundleCount++;
      applied.discountAmount = money(
        applied.discountAmount + Math.max(0, original - rule.bundlePrice),
      );
      applied.surchargeAmount = money(
        applied.surchargeAmount + Math.max(0, rule.bundlePrice - original),
      );
      for (const unit of group) {
        const existing = applied.allocations.find(
          (a) => a.productId === unit.product.id,
        );
        if (existing) {
          existing.quantity++;
          existing.total = money(existing.total + unit.total);
        } else
          applied.allocations.push({
            productId: unit.product.id,
            quantity: 1,
            total: unit.total,
          });
      }
    }
    if (applied.bundleCount) {
      applied.allocations.sort((a, b) =>
        a.productId.localeCompare(b.productId),
      );
      appliedPromotions.push(applied);
    }
  }
  const lines = [...products]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((product) => {
      const originalTotal = multiplyMoney(product.price, product.quantity);
      const total = sumMoney(
        units.filter((u) => u.product.id === product.id).map((u) => u.total),
      );
      return {
        productId: product.id,
        quantity: product.quantity,
        unitPrice: product.price,
        originalTotal,
        discount: Math.max(0, originalTotal - total),
        surcharge: Math.max(0, total - originalTotal),
        total,
      };
    });
  return {
    originalSubtotal: sumMoney(lines.map((l) => l.originalTotal)),
    promotionDiscount: sumMoney(lines.map((l) => l.discount)),
    promotionSurcharge: sumMoney(lines.map((l) => l.surcharge)),
    merchandiseTotal: sumMoney(lines.map((l) => l.total)),
    lines,
    appliedPromotions,
  };
}
