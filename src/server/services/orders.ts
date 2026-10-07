import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { sumMoney } from "@/lib/domain/money";
import { getDatabase } from "@/server/db";
import { databaseOperation, type Transaction } from "@/server/db/operations";
import {
  addresses,
  bankAccounts,
  orders,
  orderItems,
  orderPromotions,
  orderStatusHistory,
  payments,
  productImages,
  products,
  shippingQuotes,
  storeSettings,
  shipments,
} from "@/server/db/schema";
import { getEnvironment } from "@/server/env";
import { withStaff } from "@/server/auth/authorize";
import { priceLockedProducts } from "./pricing";
import { finishReservations, reserveLockedProducts } from "./inventory";
import { writeOrderState } from "./order-state";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function cartFingerprint(
  items: readonly {
    productId: string;
    quantity: number;
    weightGrams: number | null;
  }[],
) {
  return hashToken(
    JSON.stringify(
      [...items]
        .sort((a, b) => a.productId.localeCompare(b.productId))
        .map((i) => [i.productId, i.quantity, i.weightGrams]),
    ),
  );
}
const orderInput = z
  .object({
    idempotencyKey: z.uuid(),
    customerId: z.uuid(),
    addressId: z.uuid(),
    shippingQuoteId: z.uuid(),
    bankAccountId: z.uuid(),
    items: z
      .array(
        z
          .object({
            productId: z.uuid(),
            quantity: z.number().int().min(1).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    notes: z.string().max(1000).optional(),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.items.map((i) => i.productId)).size === v.items.length &&
      v.items.reduce((s, i) => s + i.quantity, 0) <= 100,
  );
async function databaseNow(tx: Transaction) {
  const result = await tx.execute<{ current_time: string }>(
    sql`select clock_timestamp() as current_time`,
  );
  const value = result.rows[0]?.current_time;
  if (!value) throw new AppError("INTERNAL_ERROR");
  return new Date(value);
}
// Internal checkout service: future HTTP entry must verify guest checkout context and rate-limit.
// No caller may supply monetary values; a trusted persisted shipping quote is mandatory.
export async function createReservedOrder(input: unknown) {
  return databaseOperation(async () => {
    const data = orderInput.parse(input);
    data.items.sort((a, b) => a.productId.localeCompare(b.productId));
    const secret = getEnvironment().AUTH_SECRET;
    if (!secret) throw new AppError("NOT_CONFIGURED");
    const token = createHmac("sha256", secret)
      .update(`order:${data.idempotencyKey}`)
      .digest("hex");
    const requestHash = hashToken(JSON.stringify(data));
    return getDatabase().transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${data.idempotencyKey}, 0))`,
      );
      const [existing] = await tx
        .select()
        .from(orders)
        .where(eq(orders.idempotencyKey, data.idempotencyKey));
      if (existing) {
        if (
          existing.requestHash !== requestHash ||
          existing.publicTokenHash !== hashToken(token)
        )
          throw new AppError("CONFLICT");
        return {
          id: existing.id,
          orderNumber: existing.orderNumber,
          publicToken: token,
          total: existing.grandTotal,
        };
      }
      await tx.execute(sql`select pg_advisory_xact_lock_shared(73102)`);
      const [settings] = await tx
        .select({ minutes: storeSettings.reservationMinutes })
        .from(storeSettings)
        .where(eq(storeSettings.id, 1));
      if (!settings?.minutes) throw new AppError("NOT_CONFIGURED");
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
      const [bank] = await tx
        .select()
        .from(bankAccounts)
        .where(
          and(
            eq(bankAccounts.id, data.bankAccountId),
            eq(bankAccounts.active, true),
          ),
        )
        .for("share");
      if (!address || !bank) throw new AppError("NOT_FOUND");
      const [quote] = await tx
        .select()
        .from(shippingQuotes)
        .where(
          and(
            eq(shippingQuotes.id, data.shippingQuoteId),
            eq(shippingQuotes.customerId, data.customerId),
            eq(shippingQuotes.addressId, data.addressId),
          ),
        )
        .for("update");
      if (!quote) throw new AppError("NOT_FOUND");
      const locked = await tx
        .select()
        .from(products)
        .where(
          inArray(
            products.id,
            data.items.map((i) => i.productId),
          ),
        )
        .orderBy(asc(products.id))
        .for("update");
      if (locked.length !== data.items.length)
        throw new AppError("PRODUCT_UNAVAILABLE");
      const priced = locked.map((product) => {
        const quantity = data.items.find(
          (i) => i.productId === product.id,
        )!.quantity;
        if (product.status !== "active" || product.quantity < quantity)
          throw new AppError("PRODUCT_UNAVAILABLE");
        return { ...product, quantity };
      });
      const now = await databaseNow(tx);
      if (quote.expiresAt <= now) throw new AppError("RESERVATION_EXPIRED");
      if (
        quote.cartFingerprint !==
        cartFingerprint(
          priced.map((p) => ({
            productId: p.id,
            quantity: p.quantity,
            weightGrams: p.weightGrams,
          })),
        )
      )
        throw new AppError("CONFLICT");
      const pricing = await priceLockedProducts(tx, priced, now);
      const due = new Date(now.getTime() + settings.minutes * 60000);
      const total = sumMoney([pricing.merchandiseTotal, quote.cost]);
      const id = randomUUID();
      const orderNumber = `ORD-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
      await tx.insert(orders).values({
        id,
        orderNumber,
        publicTokenHash: hashToken(token),
        idempotencyKey: data.idempotencyKey,
        requestHash,
        customerId: data.customerId,
        addressId: address.id,
        addressSnapshot: {
          recipientName: address.recipientName,
          phone: address.phone,
          addressLine: address.addressLine,
          province: address.province,
          city: address.city,
          district: address.district,
          subdistrict: address.subdistrict,
          postalCode: address.postalCode,
        },
        subtotal: pricing.originalSubtotal,
        discountTotal: pricing.promotionDiscount,
        surchargeTotal: pricing.promotionSurcharge,
        merchandiseTotal: pricing.merchandiseTotal,
        shippingCost: quote.cost,
        grandTotal: total,
        shippingQuoteId: quote.id,
        shippingProvider: quote.provider,
        shippingCourier: quote.courier,
        shippingService: quote.service,
        shippingEtd: quote.etd,
        paymentDueAt: due,
        notes: data.notes,
      });
      // One representative image per product; bounded query rather than a per-item query.
      const images = await tx
        .selectDistinctOn([productImages.productId], {
          productId: productImages.productId,
          key: productImages.objectKey,
        })
        .from(productImages)
        .where(
          and(
            inArray(
              productImages.productId,
              locked.map((p) => p.id),
            ),
            eq(productImages.isDefectImage, false),
          ),
        )
        .orderBy(
          asc(productImages.productId),
          asc(productImages.sortOrder),
          asc(productImages.id),
        );
      await tx.insert(orderItems).values(
        pricing.lines.map((line) => {
          const product = locked.find((p) => p.id === line.productId)!;
          return {
            orderId: id,
            productId: product.id,
            skuSnapshot: product.sku,
            nameSnapshot: product.name,
            slugSnapshot: product.slug,
            priceSnapshot: product.price,
            sizeSnapshot: product.sizeLabel,
            conditionSnapshot: product.conditionNotes,
            imageSnapshot:
              images.find((i) => i.productId === product.id)?.key ?? null,
            quantity: line.quantity,
            originalLineTotal: line.originalTotal,
            discountTotal: line.discount,
            surchargeTotal: line.surcharge,
            lineTotal: line.total,
          };
        }),
      );
      if (pricing.appliedPromotions.length)
        await tx.insert(orderPromotions).values(
          pricing.appliedPromotions.map((p) => ({
            orderId: id,
            promotionIdSnapshot: p.promotionId,
            nameSnapshot: p.name,
            requiredQuantitySnapshot: p.requiredQuantity,
            bundlePriceSnapshot: p.bundlePrice,
            bundleCount: p.bundleCount,
            discountAmount: p.discountAmount,
            surchargeAmount: p.surchargeAmount,
            allocationStrategySnapshot: p.allocationStrategy,
            pricePolicySnapshot: p.pricePolicy,
            allocations: p.allocations,
          })),
        );
      await reserveLockedProducts(tx, id, data.items, due);
      await tx.insert(payments).values({
        orderId: id,
        bankAccountId: bank.id,
        bankSnapshot: {
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          accountHolder: bank.accountHolder,
        },
        expectedAmount: total,
      });
      await tx
        .insert(orderStatusHistory)
        .values({ orderId: id, toStatus: "pending_payment" });
      return { id, orderNumber, publicToken: token, total };
    });
  });
}
export async function transitionOrder(input: unknown) {
  return withStaff("orders.update", async (tx, actor) => {
    const data = z
      .object({
        id: z.uuid(),
        to: z.enum(["processing", "completed", "cancelled"]),
      })
      .strict()
      .parse(input);
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, data.id))
      .for("update");
    if (!order) throw new AppError("NOT_FOUND");
    if (order.status === data.to) return { id: order.id, status: order.status };
    await writeOrderState(tx, order, data.to, actor.id);
    if (data.to === "cancelled")
      await finishReservations(tx, order.id, "released");
    if (data.to === "completed")
      await tx
        .update(shipments)
        .set({
          status: "delivered",
          deliveredAt: new Date(),
          updatedBy: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(shipments.orderId, order.id));
    return { id: order.id, status: data.to };
  });
}
export async function releaseExpiredReservations(limit = 50) {
  return databaseOperation(async () => {
    z.number().int().min(1).max(100).parse(limit);
    const db = getDatabase();
    const candidates = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.status, "pending_payment"),
          lte(orders.paymentDueAt, sql`now()`),
        ),
      )
      .orderBy(asc(orders.paymentDueAt))
      .limit(limit);
    let expired = 0;
    for (const candidate of candidates)
      expired += await db.transaction(async (tx) => {
        const [order] = await tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, candidate.id),
              eq(orders.status, "pending_payment"),
              lte(orders.paymentDueAt, sql`now()`),
            ),
          )
          .for("update", { skipLocked: true });
        if (!order) return 0;
        await finishReservations(tx, order.id, "released");
        await writeOrderState(tx, order, "expired", null);
        return 1;
      });
    return { expired };
  });
}
