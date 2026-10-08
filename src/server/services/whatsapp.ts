import "server-only";
import { eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { getDatabase } from "@/server/db";
import { orders, orderItems, payments, storeSettings, customers } from "@/server/db/schema";
import { getEnvironment } from "@/server/env";
import { recoverOrderToken } from "./order-tokens";
import { hashToken } from "./orders";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("id-ID").format(amount);
}

function normalizeWhatsApp(phone: string) {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }
  return cleaned;
}

export async function generateWhatsAppConfirmationUrl(publicToken: string) {
  const env = getEnvironment();
  const db = getDatabase();

  const publicTokenHash = hashToken(publicToken);

  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      customerName: customers.name,
      address: orders.addressSnapshot,
      subtotal: orders.subtotal,
      discountTotal: orders.discountTotal,
      merchandiseTotal: orders.merchandiseTotal,
      shippingCost: orders.shippingCost,
      grandTotal: orders.grandTotal,
      shippingCourier: orders.shippingCourier,
      shippingService: orders.shippingService,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.publicTokenHash, publicTokenHash));

  if (!order) {
    throw new AppError("NOT_FOUND");
  }

  // Check payment status and proof
  const [payment] = await db
    .select({
      id: payments.id,
      status: payments.status,
      proofObjectKey: payments.proofObjectKey,
      proofTokenCiphertext: payments.proofTokenCiphertext,
    })
    .from(payments)
    .where(eq(payments.orderId, order.id));

  if (!payment || payment.status !== "submitted" || !payment.proofObjectKey || !payment.proofTokenCiphertext) {
    throw new AppError("VALIDATION_ERROR", { order: ["Pesanan ini belum memiliki bukti pembayaran yang aktif."] });
  }
  
  if (order.status !== "payment_submitted") {
    throw new AppError("VALIDATION_ERROR", { order: ["Pesanan tidak dalam status menunggu verifikasi."] });
  }

  const [settings] = await db
    .select({ whatsappNumber: storeSettings.whatsappNumber })
    .from(storeSettings)
    .where(eq(storeSettings.id, 1));

  if (!settings?.whatsappNumber) {
    throw new AppError("VALIDATION_ERROR", { store: ["Nomor WhatsApp toko belum dikonfigurasi."] });
  }

  const items = await db
    .select({
      nameSnapshot: orderItems.nameSnapshot,
      sizeSnapshot: orderItems.sizeSnapshot,
      priceSnapshot: orderItems.priceSnapshot,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  const destinationNumber = normalizeWhatsApp(settings.whatsappNumber);

  const proofToken = recoverOrderToken(
    payment.proofTokenCiphertext,
    env.AUTH_SECRET!,
    payment.id
  );

  const proofUrl = `${env.APP_URL}/proof/${proofToken}`;

  const addressLine = [
    order.address.addressLine,
    order.address.district,
    order.address.city,
    order.address.province,
    order.address.postalCode,
  ].filter(Boolean).join(", ");

  let itemsText = "";
  items.forEach((item, index) => {
    const size = item.sizeSnapshot ? ` — ${item.sizeSnapshot}` : "";
    itemsText += `${index + 1}. ${item.nameSnapshot}${size} — Rp${formatMoney(item.priceSnapshot || 0)}\n`;
  });

  const discountLine = order.discountTotal && order.discountTotal > 0 
    ? `\nDiskon Promo: Rp${formatMoney(order.discountTotal)}` 
    : "";

  const message = `Halo Admin, saya ingin mengonfirmasi pembayaran pesanan saya.

*DETAIL PESANAN*
No. Pesanan: ${order.orderNumber}
Nama Pembeli: ${order.customerName}

*PRODUK PESANAN*
${itemsText.trim()}

*DETAIL PENGIRIMAN*
Penerima: ${order.address.recipientName}
Alamat: ${addressLine}
Kurir: ${order.shippingCourier}
Layanan: ${order.shippingService}

*RINGKASAN PEMBAYARAN*
Subtotal Produk: Rp${formatMoney(order.subtotal || 0)}${discountLine}
Total Produk: Rp${formatMoney(order.merchandiseTotal || 0)}
Ongkos Kirim: Rp${formatMoney(order.shippingCost || 0)}
*TOTAL PEMBAYARAN: Rp${formatMoney(order.grandTotal || 0)}*

*BUKTI PEMBAYARAN*
${proofUrl}

Mohon dilakukan pengecekan dan verifikasi pembayaran. Terima kasih.`;

  const waUrl = `https://wa.me/${destinationNumber}?text=${encodeURIComponent(message)}`;

  return waUrl;
}
