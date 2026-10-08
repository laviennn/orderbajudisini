import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getDatabase } from "@/server/db";
import { databaseOperation, type Transaction } from "@/server/db/operations";
import {
  addresses,
  categories,
  products,
  shippingQuotes,
  storeSettings,
} from "@/server/db/schema";
import { cartFingerprint } from "./orders";
import {
  destinationSchema,
  type ShippingProvider,
} from "@/server/shipping/contract";
import { getShippingProvider, quoteRates } from "@/server/shipping/provider";
import {
  shippingContextFingerprint,
  shippingWeight,
} from "@/server/shipping/context";
const uuid = z.uuid().transform((v) => v.toLowerCase());
const inputSchema = z
  .object({
    customerId: uuid,
    addressId: uuid,
    items: z
      .array(
        z
          .object({
            productId: uuid,
            quantity: z.number().int().min(1).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.items.map((i) => i.productId)).size === v.items.length &&
      v.items.reduce((sum, i) => sum + i.quantity, 0) <= 100,
  );
async function loadContext(tx: Transaction, data: z.infer<typeof inputSchema>) {
  const [store] = await tx
    .select({ origin: storeSettings.shippingOrigin })
    .from(storeSettings)
    .where(eq(storeSettings.id, 1))
    .for("share");
  const origin = destinationSchema.safeParse(store?.origin);
  if (!origin.success) throw new AppError("SHIPPING_ORIGIN_INVALID");
  const [address] = await tx
    .select()
    .from(addresses)
    .where(
      and(
        eq(addresses.id, data.addressId),
        eq(addresses.customerId, data.customerId),
      ),
    )
    .for("share");
  if (!address) throw new AppError("INVALID_DESTINATION");
  const destination = destinationSchema.safeParse(
    address && {
      province: address.province,
      city: address.city,
      district: address.district,
      subdistrict: address.subdistrict,
      postalCode: address.postalCode,
      providerDestinationId: address.providerDestinationId,
    },
  );
  if (!destination.success) throw new AppError("INVALID_DESTINATION");
  const rows = await tx
    .select()
    .from(products)
    .where(
      inArray(
        products.id,
        data.items.map((i) => i.productId),
      ),
    )
    .orderBy(asc(products.id))
    .for("share");
  const cats = rows.length
    ? await tx
        .select()
        .from(categories)
        .where(
          inArray(categories.id, [...new Set(rows.map((p) => p.categoryId))]),
        )
        .orderBy(asc(categories.id))
        .for("share")
    : [];
  if (rows.length !== data.items.length)
    throw new AppError("PRODUCT_UNAVAILABLE");
  const items = rows.map((p) => {
    const quantity = data.items.find((i) => i.productId === p.id)!.quantity;
    if (
      p.status !== "active" ||
      p.quantity < quantity ||
      !cats.find((c) => c.id === p.categoryId)?.active
    )
      throw new AppError("PRODUCT_UNAVAILABLE");
    return { productId: p.id, quantity, weightGrams: p.weightGrams };
  });
  return {
    origin: origin.data,
    destination: destination.data,
    weightGrams: shippingWeight(items),
    cartFingerprint: cartFingerprint(items),
    contextFingerprint: shippingContextFingerprint(origin.data, address),
  };
}
// Internal domain service. A future HTTP boundary must bind customer/address to verified
// guest checkout context and throttle requests; callers never supply rates or product weights.
export async function createShippingQuotes(
  input: unknown,
  provider: ShippingProvider = getShippingProvider(),
) {
  return databaseOperation(async () => {
    const data = inputSchema.parse(input);
    const db = getDatabase();
    const context = await db.transaction((tx) => loadContext(tx, data));
    const rates = await quoteRates(provider, context);
    // Network work never holds database row locks. Recheck all inputs before persisting.
    return db.transaction(async (tx) => {
      const current = await loadContext(tx, data);
      if (
        current.cartFingerprint !== context.cartFingerprint ||
        current.contextFingerprint !== context.contextFingerprint
      )
        throw new AppError("INVALID_SHIPPING_SELECTION");
      const clock = await tx.execute<{ expires: string }>(
        sql`select clock_timestamp() + interval '5 minutes' as expires`,
      );
      const expiresAt = new Date(clock.rows[0]!.expires);
      const saved = await tx
        .insert(shippingQuotes)
        .values(
          rates.map((rate) => ({
            customerId: data.customerId,
            addressId: data.addressId,
            cartFingerprint: current.cartFingerprint,
            contextFingerprint: current.contextFingerprint,
            testOnly: provider.testOnly,
            provider: rate.provider,
            courier: rate.courierCode,
            courierName: rate.courierName,
            service: rate.serviceCode,
            serviceName: rate.serviceName,
            cost: rate.cost,
            etd: rate.estimate,
            expiresAt,
          })),
        )
        .returning();
      return saved.map((q) => ({
        quoteId: q.id,
        provider: q.provider,
        courierCode: q.courier,
        courierName: q.courierName!,
        serviceCode: q.service,
        serviceName: q.serviceName!,
        cost: q.cost,
        estimate: q.etd,
        expiresAt: q.expiresAt,
        testOnly: provider.testOnly,
      }));
    });
  });
}
