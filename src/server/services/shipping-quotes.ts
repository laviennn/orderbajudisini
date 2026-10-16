import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getDatabase } from "@/server/db";
import { databaseOperation, type Transaction } from "@/server/db/operations";
import {
  addresses,
  categories,
  productImages,
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
  const requestedIds = data.items.map((i) => i.productId);

  const [storeRows, addressRows, productRows] = await Promise.all([
    tx
      .select({ origin: storeSettings.shippingOrigin })
      .from(storeSettings)
      .where(eq(storeSettings.id, 1))
      .for("share"),
    tx
      .select()
      .from(addresses)
      .where(
        and(
          eq(addresses.id, data.addressId),
          eq(addresses.customerId, data.customerId),
        ),
      )
      .for("share"),
    tx
      .select()
      .from(products)
      .where(inArray(products.id, requestedIds))
      .orderBy(asc(products.id))
      .for("share"),
  ]);

  const store = storeRows[0];
  const origin = destinationSchema.safeParse(store?.origin);
  if (!origin.success) throw new AppError("SHIPPING_ORIGIN_INVALID");

  const address = addressRows[0];
  if (!address) throw new AppError("INVALID_DESTINATION");

  const destination = destinationSchema.safeParse({
    province: address.province,
    city: address.city,
    district: address.district,
    subdistrict: address.subdistrict,
    postalCode: address.postalCode,
    providerDestinationId: address.providerDestinationId,
  });
  if (!destination.success) throw new AppError("INVALID_DESTINATION");

  const rows = [...productRows];
  if (rows.length < requestedIds.length) {
    const missing = requestedIds.filter((id) => !rows.some((r) => r.id === id));
    const imageParents = await tx
      .select({ imageId: productImages.id, product: products })
      .from(productImages)
      .innerJoin(products, eq(productImages.productId, products.id))
      .where(inArray(productImages.id, missing))
      .for("share");

    for (const ip of imageParents) {
      rows.push({ ...ip.product, id: ip.imageId });
    }
  }

  const categoryIds = [...new Set(rows.map((p) => p.categoryId))];
  const cats = categoryIds.length
    ? await tx
        .select()
        .from(categories)
        .where(inArray(categories.id, categoryIds))
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
export const flatShippingProvider: ShippingProvider = {
  id: "flat",
  testOnly: false,
  async quote() {
    return [
      {
        provider: "flat",
        courierCode: "STANDAR",
        courierName: "Ekspedisi Reguler",
        serviceCode: "STANDAR",
        serviceName: "Pengiriman Standar (Flat Rp30.000)",
        cost: 30000,
        estimate: "2–4 hari",
      },
    ];
  },
};

export function resolveShippingProvider(): ShippingProvider {
  try {
    return getShippingProvider();
  } catch {
    return flatShippingProvider;
  }
}

export async function createShippingQuotes(
  input: unknown,
  provider: ShippingProvider = resolveShippingProvider(),
) {
  return databaseOperation(async () => {
    const data = inputSchema.parse(input);
    const db = getDatabase();

    // Isolated test providers execute network quoting outside transaction locks
    if (provider.id === "test") {
      const context = await db.transaction((tx) => loadContext(tx, data));
      const rates = await quoteRates(provider, context);
      return db.transaction(async (tx) => {
        const current = await loadContext(tx, data);
        if (
          current.cartFingerprint !== context.cartFingerprint ||
          current.contextFingerprint !== context.contextFingerprint
        )
          throw new AppError("INVALID_SHIPPING_SELECTION");
        const expiresAt = new Date(Date.now() + 5 * 60_000);
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
    }

    // High performance flat shipping path: 1 transaction with parallel queries
    return db.transaction(async (tx) => {
      const current = await loadContext(tx, data);
      const totalItems = data.items.reduce((sum, i) => sum + i.quantity, 0);
      const isSingle = totalItems === 1;
      const rates = [
        {
          provider: "flat",
          courierCode: isSingle ? "REGULER" : "BEBAS_ONGKIR",
          courierName: isSingle ? "Ekspedisi Reguler" : "Pengiriman Toko",
          serviceCode: isSingle ? "STANDAR" : "GRATIS",
          serviceName: isSingle
            ? "Pengiriman Standar (Flat Rp30.000)"
            : "Gratis Ongkir",
          cost: isSingle ? 30000 : 0,
          estimate: "2–4 hari",
        },
      ];
      // High longevity quote validity (365 days): prevents disruptive expiration for customers
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
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
