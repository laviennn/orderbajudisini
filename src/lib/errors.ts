export type ErrorCode =
  | "INVALID_DESTINATION"
  | "SHIPPING_NOT_CONFIGURED"
  | "SHIPPING_PROVIDER_UNAVAILABLE"
  | "SHIPPING_NO_SERVICES"
  | "SHIPPING_QUOTE_EXPIRED"
  | "INVALID_SHIPPING_SELECTION"
  | "SHIPPING_WEIGHT_INVALID"
  | "SHIPPING_ORIGIN_INVALID"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PRODUCT_UNAVAILABLE"
  | "INVALID_ORDER_TRANSITION"
  | "INVALID_PAYMENT_TRANSITION"
  | "PAYMENT_ALREADY_VERIFIED"
  | "RESERVATION_EXPIRED"
  | "LAST_OWNER"
  | "BOOTSTRAP_CLOSED"
  | "RATE_LIMITED"
  | "PRICING_NOT_CONFIGURED"
  | "NOT_CONFIGURED"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "PROVIDER_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type ApiError = {
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
};

const messages: Record<ErrorCode, string> = {
  INVALID_DESTINATION: "Tujuan pengiriman tidak valid.",
  SHIPPING_NOT_CONFIGURED: "Layanan ongkir belum dikonfigurasi.",
  SHIPPING_PROVIDER_UNAVAILABLE:
    "Layanan ongkir sedang tidak tersedia. Coba lagi nanti.",
  SHIPPING_NO_SERVICES: "Tidak ada layanan pengiriman untuk tujuan ini.",
  SHIPPING_QUOTE_EXPIRED: "Pilihan ongkir kedaluwarsa. Minta ongkir terbaru.",
  INVALID_SHIPPING_SELECTION:
    "Pilihan pengiriman tidak valid. Minta ongkir terbaru.",
  SHIPPING_WEIGHT_INVALID: "Berat produk belum lengkap atau tidak valid.",
  SHIPPING_ORIGIN_INVALID:
    "Asal pengiriman toko belum dikonfigurasi dengan benar.",

  NOT_FOUND: "Data tidak ditemukan.",
  CONFLICT:
    "Data sudah berubah atau sudah digunakan. Muat ulang dan coba lagi.",
  PRODUCT_UNAVAILABLE: "Produk tidak lagi tersedia dalam jumlah yang diminta.",
  INVALID_ORDER_TRANSITION: "Perubahan status pesanan tidak diizinkan.",
  INVALID_PAYMENT_TRANSITION: "Perubahan status pembayaran tidak diizinkan.",
  PAYMENT_ALREADY_VERIFIED: "Pembayaran sudah diverifikasi.",
  RESERVATION_EXPIRED: "Batas waktu reservasi telah berakhir.",
  LAST_OWNER: "Toko harus memiliki setidaknya satu pemilik aktif.",
  BOOTSTRAP_CLOSED: "Inisialisasi pemilik pertama sudah dilakukan.",
  RATE_LIMITED: "Terlalu banyak percobaan. Coba lagi nanti.",
  PRICING_NOT_CONFIGURED: "Aturan harga promosi belum lengkap.",
  NOT_CONFIGURED: "Layanan belum tersedia.",
  VALIDATION_ERROR: "Periksa kembali data yang dikirim.",
  UNAUTHENTICATED: "Silakan masuk terlebih dahulu.",
  FORBIDDEN: "Anda tidak memiliki izin untuk tindakan ini.",
  PROVIDER_UNAVAILABLE:
    "Layanan sedang tidak dapat dihubungi. Coba lagi nanti.",
  INTERNAL_ERROR: "Terjadi kesalahan. Coba lagi nanti.",
};

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(messages[code]);
    this.name = "AppError";
  }
}

export function toApiError(error: unknown, requestId?: string): ApiError {
  const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
  return {
    code,
    message: messages[code],
    ...(error instanceof AppError && error.fieldErrors
      ? { fieldErrors: error.fieldErrors }
      : {}),
    ...(requestId ? { requestId } : {}),
  };
}
