import { z } from "zod";
import type { OrderState, PaymentState } from "./domain/states";
export const listInput = z.object({
  q: z.string().trim().max(80).default(""),
  page: z.coerce.number().int().min(1).max(10000).catch(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});
export const searchPattern = (value: string) =>
  `%${value.replace(/[\\%_]/g, "\\$&")}%`;
export const orderLabels: Record<OrderState, string> = {
  pending_payment: "Menunggu pembayaran",
  payment_submitted: "Menunggu verifikasi",
  payment_verified: "Pembayaran terverifikasi",
  processing: "Diproses",
  shipped: "Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};
export const paymentLabels: Record<PaymentState, string> = {
  pending: "Menunggu pembayaran",
  submitted: "Menunggu verifikasi",
  verified: "Terverifikasi",
  rejected: "Ditolak",
};
export const dateTime = (date: Date | string | null) =>
  date
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(date))
    : "—";
