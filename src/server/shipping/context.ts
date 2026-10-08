import "server-only";
import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";
import type { ShippingDestination } from "./contract";
export function shippingContextFingerprint(
  origin: ShippingDestination,
  address: {
    recipientName: string;
    phone: string;
    addressLine: string;
    province: string;
    city: string;
    district: string;
    subdistrict: string | null;
    postalCode: string;
    providerDestinationId: string | null;
  },
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        origin.province,
        origin.city,
        origin.district,
        origin.subdistrict,
        origin.postalCode,
        origin.providerDestinationId,
        address.recipientName,
        address.phone,
        address.addressLine,
        address.province,
        address.city,
        address.district,
        address.subdistrict,
        address.postalCode,
        address.providerDestinationId,
      ]),
    )
    .digest("hex");
}
export function shippingWeight(
  items: { weightGrams: number | null; quantity: number }[],
) {
  if (
    !items.length ||
    items.some(
      (i) =>
        !Number.isSafeInteger(i.weightGrams) ||
        !i.weightGrams ||
        i.weightGrams < 1 ||
        !Number.isInteger(i.quantity) ||
        i.quantity < 1,
    )
  )
    throw new AppError("SHIPPING_WEIGHT_INVALID");
  const total = items.reduce((sum, i) => sum + i.weightGrams! * i.quantity, 0);
  if (!Number.isSafeInteger(total) || total > 10000000)
    throw new AppError("SHIPPING_WEIGHT_INVALID");
  return total;
}
