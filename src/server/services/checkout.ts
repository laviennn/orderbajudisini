import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getEnvironment } from "@/server/env";
import { getDatabase } from "@/server/db";
import { databaseOperation } from "@/server/db/operations";
import {
  addresses,
  bankAccounts,
  qrisSettings,
  customers,
  orders,
  orderItems,
  payments,
  shipments,
} from "@/server/db/schema";
import { cartInput, validateCart } from "./cart";
import { createShippingQuotes } from "./shipping-quotes";
import { createReservedOrder, hashToken } from "./orders";
import { destinationSchema } from "@/server/shipping/contract";
import { getShippingProvider } from "@/server/shipping/provider";
import { getStorage } from "@/server/storage/r2";

export function normalizePhone(value: string) {
  let phone = value.replace(/[\s().-]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
  if (!/^628\d{8,11}$/.test(phone))
    throw new AppError("VALIDATION_ERROR", {
      phone: ["Gunakan nomor Indonesia yang valid, misalnya 08… atau +628…."],
    });
  return `+${phone}`;
}
const details = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().nullable().optional(),
    phone: z.string().min(8).max(30).transform(normalizePhone),
    recipientName: z.string().trim().min(2).max(120),
    addressLine: z.string().trim().min(5).max(500),
    notes: z.string().trim().max(1000).optional(),
    ...destinationSchema.shape,
  })
  .strict();
const prepareInput = z
  .object({ ids: cartInput.shape.ids.min(1), customer: details })
  .strict();
export type Ticket = {
  customerId: string;
  addressId: string;
  items: { productId: string; quantity: number }[];
  idempotencyKey: string;
  shippingQuoteId: string;
  merchandiseTotal: number;
  expires: number;
  notes?: string;
};
function key() {
  const secret = getEnvironment().AUTH_SECRET;
  if (!secret) throw new AppError("NOT_CONFIGURED");
  return createHash("sha256").update(`checkout-v1:${secret}`).digest();
}
export function seal(data: Ticket) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([
    iv,
    cipher.update(JSON.stringify(data)),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64url");
}
export function open(value: string): Ticket {
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(-16));
    const data = JSON.parse(
      Buffer.concat([
        decipher.update(raw.subarray(12, -16)),
        decipher.final(),
      ]).toString(),
    ) as Ticket;
    if (data.expires < Date.now()) throw new Error();
    return data;
  } catch {
    throw new AppError("INVALID_SHIPPING_SELECTION");
  }
}
export async function prepareCheckout(input: unknown) {
  return databaseOperation(async () => {
    const data = prepareInput.parse(input);
    const cart = await validateCart({ ids: data.ids });
    if (!cart.pricing || cart.items.some((i) => !i.available))
      return { cart, choices: [], payments: [] };
    const provider = getShippingProvider();
    const db = getDatabase();

    // Fetch available payment methods
    const [qris, banks] = await Promise.all([
      db.select().from(qrisSettings).where(eq(qrisSettings.id, 1)).limit(1),
      db
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.active, true))
        .orderBy(asc(bankAccounts.sortOrder), asc(bankAccounts.id)),
    ]);
    const availablePayments = [];
    if (qris[0]?.active && qris[0]?.imageObjectKey)
      availablePayments.push({ id: "qris", name: "QRIS", type: "qris" });
    banks.forEach((b) =>
      availablePayments.push({
        id: b.id,
        name: `${b.bankName} - ${b.accountNumber}`,
        type: "bank_transfer",
      }),
    );

    if (availablePayments.length === 0) throw new AppError("NOT_CONFIGURED");

    const context = await db.transaction(async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({
          name: data.customer.name,
          phone: data.customer.phone,
          email: data.customer.email,
        })
        .returning();
      const {
        name: _name,
        email: _email,
        notes: _notes,
        ...address
      } = data.customer;
      void _name;
      void _email;
      void _notes;
      const [saved] = await tx
        .insert(addresses)
        .values({ ...address, customerId: customer!.id })
        .returning();
      return { customerId: customer!.id, addressId: saved!.id };
    });
    const items = data.ids.map((productId) => ({ productId, quantity: 1 }));
    const quotes = await createShippingQuotes({ ...context, items }, provider);
    const idempotencyKey = randomUUID();
    return {
      cart,
      choices: quotes.map((q) => ({
        reference: seal({
          ...context,
          items,
          idempotencyKey,
          shippingQuoteId: q.quoteId,
          merchandiseTotal: cart.pricing!.merchandiseTotal,
          expires: Date.now() + 86400000,
          notes: data.customer.notes,
        }),
        courier: q.courierName,
        service: q.serviceName,
        estimate: q.estimate,
        cost: q.cost,
        total: cart.pricing!.merchandiseTotal + q.cost,
        expiresAt: q.expiresAt.toISOString(),
        testOnly: q.testOnly,
      })),
      payments: availablePayments,
    };
  });
}
export async function submitCheckout(input: unknown) {
  return databaseOperation(async () => {
    const { reference, paymentMethodId } = z
      .object({
        reference: z.string().min(50).max(20000),
        paymentMethodId: z.string().trim().min(1),
      })
      .strict()
      .parse(input);
    const { expires: _expires, merchandiseTotal, ...request } = open(reference);
    void _expires;

    const paymentMethod = paymentMethodId === "qris" ? "qris" : "bank_transfer";
    const bankAccountId =
      paymentMethodId === "qris" ? undefined : paymentMethodId;

    const result = await createReservedOrder(
      { ...request, paymentMethod, bankAccountId },
      { expectedMerchandiseTotal: merchandiseTotal },
    );
    return { publicToken: result.publicToken };
  });
}
export async function publicOrder(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return databaseOperation(async () => {
    const db = getDatabase();
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.publicTokenHash, hashToken(token)))
      .limit(1);
    if (!order) return null;
    const items = await db
      .select({
        name: orderItems.nameSnapshot,
        quantity: orderItems.quantity,
        total: orderItems.lineTotal,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const [payment] = await db
      .select({
        method: payments.method,
        bankSnapshot: payments.bankSnapshot,
        qrisSnapshot: payments.qrisSnapshot,
        status: payments.status,
        proofSubmitted: payments.proofObjectKey,
      })
      .from(payments)
      .where(eq(payments.orderId, order.id));
    const [shipment] = await db
      .select({
        trackingNumber: shipments.trackingNumber,
        courier: shipments.courier,
        service: shipments.service,
      })
      .from(shipments)
      .where(eq(shipments.orderId, order.id));
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      items,
      merchandiseTotal: order.subtotal - order.discountTotal,
      shipping: order.shippingCost,
      total: order.grandTotal,
      deadline: order.paymentDueAt,
      paymentMethod: payment?.method,
      bank:
        payment?.method === "bank_transfer" && payment.bankSnapshot
          ? {
              bankName: payment.bankSnapshot.bankName,
              accountNumber: payment.bankSnapshot.accountNumber,
              accountHolder: payment.bankSnapshot.accountHolder,
              instructions: payment.bankSnapshot.instructions,
            }
          : null,
      qris:
        payment?.method === "qris" && payment.qrisSnapshot
          ? {
              merchantName: payment.qrisSnapshot.merchantName,
              imageObjectKey: payment.qrisSnapshot.imageObjectKey,
              imageUrl: (() => {
                try {
                  return payment.qrisSnapshot.imageObjectKey
                    ? getStorage().publicMediaUrl(
                        payment.qrisSnapshot.imageObjectKey,
                      )
                    : null;
                } catch {
                  return null;
                }
              })(),
              instructions: payment.qrisSnapshot.instructions,
            }
          : null,
      payment: payment
        ? {
            status: payment.status,
            proofSubmitted: payment.proofSubmitted !== null,
          }
        : null,
      address: order.addressSnapshot,
      shippingDetails: {
        provider: order.shippingProvider,
        courier: order.shippingCourier,
        service: order.shippingService,
        etd: order.shippingEtd,
        trackingNumber: shipment?.trackingNumber ?? null,
      },
    };
  });
}
export type CheckoutPreview = Awaited<ReturnType<typeof prepareCheckout>>;
