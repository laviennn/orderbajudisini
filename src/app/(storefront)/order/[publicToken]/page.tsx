import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { publicOrder } from "@/server/services/checkout";
import { formatIdr } from "@/lib/domain/money";
import { ProductPhoto } from "@/features/storefront/Interactions";
import { PaymentProofUpload } from "@/features/checkout/PaymentProofUpload";
import { WhatsAppConfirmation } from "@/features/checkout/WhatsAppConfirmation";
import {
  ShippingIcon,
  MapPinIcon,
  CheckIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "@/features/checkout/Icons";
import { CopyButton } from "@/features/checkout/CopyButton";

export const metadata: Metadata = {
  title: "Status Pesanan - Thrift Commerce",
  robots: {
    index: false,
    follow: false,
  },
};

function formatOrderDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;
  const order = await publicOrder(publicToken);

  if (!order) {
    notFound();
  }

  const isPendingPayment = order.status === "pending_payment";
  const isPaymentSubmitted = order.status === "payment_submitted";
  const isPaymentVerified = order.status === "payment_verified";
  const isProcessing = order.status === "processing";
  const isShipped = order.status === "shipped";
  const isCompleted = order.status === "completed";
  const isCancelled = order.status === "cancelled";
  const isPaymentRejected =
    isPendingPayment && order.payment?.status === "rejected";

  return (
    <main
      className="section-space page-width"
      style={{
        paddingTop: "2rem",
        paddingBottom: "5rem",
        maxWidth: "880px",
        margin: "0 auto",
      }}
    >
      {/* Top Navigation & Status */}
      <div style={{ marginBottom: "1.75rem" }}>
        <Link
          href="/products"
          className="text-link"
          style={{
            fontSize: "0.875rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            color: "var(--muted-foreground, #62675c)",
            marginBottom: "1rem",
            textDecoration: "none",
          }}
        >
          <span aria-hidden="true">&larr;</span> Kembali ke Katalog Produk
        </Link>
      </div>

      {/* Main Status Hero Card */}
      <section
        aria-label="Status Pesanan"
        style={{
          background: isPaymentSubmitted
            ? "linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)"
            : isPaymentVerified || isProcessing
              ? "linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)"
              : isShipped
                ? "linear-gradient(180deg, #faf5ff 0%, #ffffff 100%)"
                : isCancelled
                  ? "linear-gradient(180deg, #fef2f2 0%, #ffffff 100%)"
                  : "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)",
          border: isPaymentSubmitted
            ? "1px solid #bbf7d0"
            : isPaymentVerified || isProcessing
              ? "1px solid #a7f3d0"
              : isShipped
                ? "1px solid #e9d5ff"
                : isCancelled
                  ? "1px solid #fecaca"
                  : "1px solid #fde68a",
          borderRadius: "12px",
          padding: "2rem",
          marginBottom: "2rem",
          boxShadow: "0 4px 20px -4px rgba(0, 0, 0, 0.05)",
          textAlign: "center",
        }}
      >
        {/* Status Badge Icon */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            margin: "0 auto 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isPaymentSubmitted
              ? "#dcfce7"
              : isPaymentVerified || isProcessing
                ? "#d1fae5"
                : isShipped
                  ? "#f3e8ff"
                  : isCancelled
                    ? "#fee2e2"
                    : "#fef3c7",
            color: isPaymentSubmitted
              ? "#16a34a"
              : isPaymentVerified || isProcessing
                ? "#059669"
                : isShipped
                  ? "#9333ea"
                  : isCancelled
                    ? "#dc2626"
                    : "#d97706",
          }}
        >
          {isPaymentSubmitted ||
          isPaymentVerified ||
          isProcessing ||
          isCompleted ? (
            <CheckIcon size={28} />
          ) : isShipped ? (
            <ShippingIcon size={26} />
          ) : isCancelled ? (
            <span style={{ fontSize: "24px", fontWeight: "bold" }}>
              &times;
            </span>
          ) : (
            <ClockIcon size={28} />
          )}
        </div>

        {/* Status Title */}
        <h1
          style={{
            fontSize: "clamp(1.5rem, 3vw, 1.875rem)",
            fontWeight: 700,
            margin: "0 0 0.5rem",
            color: "var(--foreground, #242922)",
            fontFamily: "var(--font-display, Georgia, serif)",
          }}
        >
          {isPendingPayment &&
            !isPaymentRejected &&
            "Pesanan Diterima - Menunggu Pembayaran"}
          {isPaymentRejected && "Pembayaran Ditolak - Unggah Ulang Bukti"}
          {isPaymentSubmitted && "Bukti Pembayaran Sedang Diverifikasi"}
          {isPaymentVerified && "Pembayaran Terverifikasi - Siap Diproses"}
          {isProcessing && "Pesanan Sedang Diproses"}
          {isShipped && "Pesanan Telah Dikirim"}
          {isCompleted && "Pesanan Selesai"}
          {isCancelled && "Pesanan Dibatalkan"}
        </h1>

        <p
          style={{
            margin: "0 auto 1.5rem",
            maxWidth: "600px",
            fontSize: "0.95rem",
            color: "var(--muted-foreground, #62675c)",
            lineHeight: 1.5,
          }}
        >
          {isPendingPayment &&
            !isPaymentRejected &&
            "Silakan lakukan transfer sesuai rincian rekening atau scan QRIS di bawah ini, lalu unggah bukti transfer agar pesanan Anda dapat segera kami proses."}
          {isPaymentRejected &&
            "Bukti pembayaran sebelumnya belum dapat diverifikasi oleh admin. Harap periksa kembali dan unggah foto bukti transfer yang valid."}
          {isPaymentSubmitted &&
            "Bukti transfer Anda telah berhasil dikirim ke sistem. Tim kami sedang memverifikasi pembayaran Anda. Anda juga dapat melakukan konfirmasi langsung ke WhatsApp toko kami."}
          {isPaymentVerified &&
            "Pembayaran Anda telah dikonfirmasi valid. Barang sedang disiapkan untuk proses packing dan penyerahan ke kurir."}
          {isProcessing &&
            "Pesanan Anda sedang dalam tahap pengemasan rapi dan pengecekan kualitas."}
          {isShipped &&
            "Barang Anda sudah dalam perjalanan bersama kurir. Pantau nomor resi di bawah ini."}
          {isCompleted && "Terima kasih telah berbelanja di Thrift Commerce!"}
          {isCancelled && "Pesanan ini telah dibatalkan."}
        </p>

        {/* Order Meta Bar */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.75rem",
            padding: "0.625rem 1.25rem",
            background: "#ffffff",
            border: "1px solid var(--border, #d4d5cc)",
            borderRadius: "9999px",
            fontSize: "0.875rem",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "var(--muted-foreground, #62675c)" }}>
              No. Pesanan:
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 700,
                color: "var(--foreground, #242922)",
              }}
            >
              {order.orderNumber}
            </span>
            <CopyButton
              text={order.orderNumber}
              subject="Nomor pesanan"
              label="Salin"
            />
          </div>
          {order.createdAt && (
            <>
              <span style={{ color: "var(--border, #d4d5cc)" }}>&bull;</span>
              <span
                style={{
                  color: "var(--muted-foreground, #62675c)",
                  fontSize: "0.8125rem",
                }}
              >
                {formatOrderDate(order.createdAt)}
              </span>
            </>
          )}
        </div>
      </section>

      {/* Payment Instructions Card (For Pending or Submitted Payment) */}
      {(isPendingPayment || isPaymentSubmitted) && (
        <section
          aria-label="Instruksi Pembayaran"
          style={{
            background: "#ffffff",
            border: "1px solid var(--border, #d4d5cc)",
            borderRadius: "12px",
            padding: "clamp(1.25rem, 3vw, 2rem)",
            marginBottom: "2rem",
            boxShadow: "0 4px 16px -2px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Tagihan Highlight Box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
              padding: "1.25rem 1.5rem",
              background: "linear-gradient(135deg, #f8f7f3 0%, #f0fdf4 100%)",
              border: "1px solid #bbf7d0",
              borderRadius: "8px",
              marginBottom: "1.75rem",
            }}
          >
            <div>
              <span
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#166534",
                  marginBottom: "0.25rem",
                }}
              >
                Total Yang Harus Dibayar
              </span>
              <div
                style={{
                  fontSize: "clamp(1.5rem, 3.5vw, 1.875rem)",
                  fontWeight: 800,
                  color: "#14532d",
                  fontFamily: "var(--font-display, Georgia, serif)",
                  lineHeight: 1.2,
                }}
              >
                {formatIdr(order.total)}
              </div>
            </div>
            <CopyButton
              text={String(order.total)}
              label="Salin Nominal"
              subject="Nominal tagihan"
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #86efac",
                color: "#166534",
                padding: "0.375rem 0.875rem",
              }}
            />
          </div>

          {/* Payment Method Details */}
          {order.paymentMethod === "bank_transfer" && order.bank && (
            <div>
              <h2
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  margin: "0 0 0.5rem",
                  color: "var(--foreground, #242922)",
                }}
              >
                Transfer Bank Manual
              </h2>
              <p
                style={{
                  margin: "0 0 1rem",
                  fontSize: "0.875rem",
                  color: "var(--muted-foreground, #62675c)",
                }}
              >
                Silakan lakukan transfer ke rekening resmi berikut dengan
                nominal tepat:
              </p>

              {/* Bank Card Box */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1.25rem",
                  padding: "1.25rem",
                  backgroundColor: "#fafaf9",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #d4d5cc)",
                  flexWrap: "wrap",
                }}
              >
                {order.bank.logoUrl && (
                  <div
                    style={{
                      width: "80px",
                      height: "52px",
                      backgroundColor: "#ffffff",
                      borderRadius: "6px",
                      border: "1px solid var(--border, #d4d5cc)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "6px",
                      flexShrink: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.bank.logoUrl}
                      alt={`Logo ${order.bank.bankName}`}
                      style={{
                        objectFit: "contain",
                        maxHeight: "100%",
                        width: "auto",
                      }}
                    />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: "220px" }}>
                  <div
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: "var(--foreground, #242922)",
                    }}
                  >
                    {order.bank.bankName}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      marginTop: "0.375rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "1.25rem",
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        color: "var(--foreground, #242922)",
                      }}
                    >
                      {order.bank.accountNumber}
                    </span>
                    <CopyButton
                      text={order.bank.accountNumber}
                      subject="Nomor rekening"
                      label="Salin Rekening"
                      style={{
                        backgroundColor: "#ffffff",
                        border: "1px solid var(--border, #d4d5cc)",
                        padding: "0.3125rem 0.75rem",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      marginTop: "0.375rem",
                      color: "var(--muted-foreground, #62675c)",
                      fontSize: "0.875rem",
                    }}
                  >
                    Atas Nama: <strong>{order.bank.accountHolder}</strong>
                  </div>
                </div>
              </div>

              {order.bank.instructions && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.875rem 1rem",
                    backgroundColor: "#f4f4f5",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "var(--foreground, #242922)",
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Instruksi Transfer:</strong> {order.bank.instructions}
                </div>
              )}
            </div>
          )}

          {/* QRIS Details */}
          {order.paymentMethod === "qris" && order.qris && (
            <div>
              <h2
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  margin: "0 0 0.5rem",
                  color: "var(--foreground, #242922)",
                }}
              >
                Pembayaran Melalui QRIS
              </h2>
              <p
                style={{
                  margin: "0 0 1rem",
                  fontSize: "0.875rem",
                  color: "var(--muted-foreground, #62675c)",
                }}
              >
                Scan kode QRIS di bawah ini menggunakan aplikasi m-Banking atau
                e-Wallet pilihan Anda:
              </p>

              <div
                style={{
                  padding: "1.5rem",
                  backgroundColor: "#fafaf9",
                  borderRadius: "8px",
                  textAlign: "center",
                  border: "1px solid var(--border, #d4d5cc)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.75rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div
                    style={{
                      width: "72px",
                      height: "44px",
                      backgroundColor: "#ffffff",
                      borderRadius: "6px",
                      border: "1px solid var(--border, #d4d5cc)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "4px",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/qris.webp"
                      alt="QRIS Logo"
                      style={{
                        objectFit: "contain",
                        maxHeight: "100%",
                        width: "auto",
                      }}
                    />
                  </div>
                  {order.qris.merchantName && (
                    <strong style={{ fontSize: "1.1rem" }}>
                      {order.qris.merchantName}
                    </strong>
                  )}
                </div>

                {order.qris.imageUrl && (
                  <div
                    style={{
                      padding: "1rem",
                      backgroundColor: "#ffffff",
                      borderRadius: "10px",
                      border: "1px solid var(--border, #d4d5cc)",
                      display: "inline-block",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.qris.imageUrl}
                      alt={order.qris.merchantName || "QRIS"}
                      style={{
                        maxWidth: "280px",
                        maxHeight: "280px",
                        objectFit: "contain",
                        margin: "0 auto",
                        display: "block",
                      }}
                    />
                  </div>
                )}
                <div
                  style={{
                    marginTop: "0.875rem",
                    fontSize: "0.8125rem",
                    color: "var(--muted-foreground, #62675c)",
                  }}
                >
                  BCA &bull; Mandiri &bull; BRI &bull; BNI &bull; GoPay &bull;
                  OVO &bull; Dana &bull; ShopeePay
                </div>
              </div>

              {order.qris.instructions && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.875rem 1rem",
                    backgroundColor: "#f4f4f5",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                    color: "var(--foreground, #242922)",
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Instruksi:</strong> {order.qris.instructions}
                </div>
              )}
            </div>
          )}

          {/* Payment Proof Component & WhatsApp CTAs */}
          {isPendingPayment && (
            <div style={{ marginTop: "1.75rem" }}>
              <PaymentProofUpload publicToken={publicToken} />
              <WhatsAppConfirmation publicToken={publicToken} />
            </div>
          )}

          {isPaymentSubmitted && (
            <div style={{ marginTop: "1.75rem" }}>
              {/* Submitted Notice Banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "1rem 1.25rem",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  color: "#166534",
                }}
              >
                <CheckIcon
                  size={20}
                  style={{ color: "#16a34a", marginTop: "2px" }}
                />
                <div>
                  <strong
                    style={{
                      display: "block",
                      marginBottom: "0.25rem",
                      fontSize: "0.95rem",
                    }}
                  >
                    Bukti Pembayaran Telah Kami Terima
                  </strong>
                  Bukti transfer Anda saat ini sedang dalam antrean verifikasi
                  oleh tim admin kami. Anda juga dapat konfirmasi langsung ke
                  WhatsApp untuk proses yang lebih cepat.
                </div>
              </div>

              <WhatsAppConfirmation publicToken={publicToken} />

              <details
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem 1rem",
                  backgroundColor: "#fafaf9",
                  border: "1px solid var(--border, #d4d5cc)",
                  borderRadius: "8px",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--foreground, #242922)",
                  }}
                >
                  Ingin mengunggah ulang bukti pembayaran? (Klik di sini)
                </summary>
                <div style={{ marginTop: "0.5rem" }}>
                  <PaymentProofUpload publicToken={publicToken} />
                </div>
              </details>
            </div>
          )}
        </section>
      )}

      {/* Grid 2-Column: Delivery Info & Shipping Courier */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* Shipping Address Card */}
        <section
          aria-label="Alamat Pengiriman"
          style={{
            background: "#ffffff",
            border: "1px solid var(--border, #d4d5cc)",
            borderRadius: "12px",
            padding: "1.5rem",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
              paddingBottom: "0.75rem",
              borderBottom: "1px solid var(--border, #d4d5cc)",
            }}
          >
            <MapPinIcon
              size={18}
              style={{ color: "var(--primary, #354a37)" }}
            />
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
              Alamat Pengiriman
            </h2>
          </div>
          <address
            style={{
              fontStyle: "normal",
              color: "var(--foreground, #242922)",
              lineHeight: 1.6,
              fontSize: "0.925rem",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                marginBottom: "0.25rem",
              }}
            >
              {order.address.recipientName}
            </div>
            <div
              style={{
                color: "var(--muted-foreground, #62675c)",
                marginBottom: "0.5rem",
              }}
            >
              <a
                href={`tel:${order.address.phone}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                📞 {order.address.phone}
              </a>
            </div>
            <div>{order.address.addressLine}</div>
            <div>
              {order.address.subdistrict
                ? `${order.address.subdistrict}, `
                : ""}
              {order.address.district}
            </div>
            <div style={{ color: "var(--muted-foreground, #62675c)" }}>
              {order.address.city}, {order.address.province}{" "}
              {order.address.postalCode}
            </div>
          </address>
        </section>

        {/* Shipping Method Card */}
        <section
          aria-label="Layanan Ekspedisi"
          style={{
            background: "#ffffff",
            border: "1px solid var(--border, #d4d5cc)",
            borderRadius: "12px",
            padding: "1.5rem",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
              paddingBottom: "0.75rem",
              borderBottom: "1px solid var(--border, #d4d5cc)",
            }}
          >
            <ShippingIcon
              size={18}
              style={{ color: "var(--primary, #354a37)" }}
            />
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
              Layanan Ekspedisi
            </h2>
          </div>
          <div>
            <div
              style={{
                display: "inline-block",
                padding: "0.35rem 0.75rem",
                borderRadius: "4px",
                backgroundColor: "var(--accent, #e3e8dd)",
                color: "var(--accent-foreground, #293c2b)",
                fontWeight: 700,
                fontSize: "0.875rem",
                marginBottom: "0.75rem",
              }}
            >
              {order.shippingDetails.courier} - {order.shippingDetails.service}
            </div>
            {order.shippingDetails.etd && (
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "var(--muted-foreground, #62675c)",
                  marginBottom: "0.5rem",
                }}
              >
                Estimasi Pengiriman:{" "}
                <strong>{order.shippingDetails.etd}</strong>
              </div>
            )}
            {order.shippingDetails.trackingNumber ? (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  backgroundColor: "#faf5ff",
                  border: "1px solid #e9d5ff",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#6b21a8",
                    fontWeight: 600,
                  }}
                >
                  NOMOR RESI PENGIRIMAN:
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      color: "#581c87",
                    }}
                  >
                    {order.shippingDetails.trackingNumber}
                  </span>
                  <CopyButton
                    text={order.shippingDetails.trackingNumber}
                    subject="Nomor resi"
                    label="Salin"
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.8125rem",
                  color: "var(--muted-foreground, #62675c)",
                }}
              >
                Nomor resi akan otomatis terbit setelah pesanan diserahkan ke
                pihak ekspedisi.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Order Items & Financial Summary */}
      <section
        aria-label="Ringkasan Produk"
        style={{
          background: "#ffffff",
          border: "1px solid var(--border, #d4d5cc)",
          borderRadius: "12px",
          padding: "clamp(1.25rem, 3vw, 2rem)",
          marginBottom: "2.5rem",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "1rem",
            marginBottom: "1.5rem",
            borderBottom: "1px solid var(--border, #d4d5cc)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
            Ringkasan Produk ({order.items.length})
          </h2>
          <span
            style={{
              fontSize: "0.875rem",
              color: "var(--muted-foreground, #62675c)",
            }}
          >
            Thrift One-of-a-Kind
          </span>
        </div>

        {/* Product Items List */}
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {order.items.map((item, idx) => (
            <li
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1.25rem",
                paddingBottom: idx < order.items.length - 1 ? "1.25rem" : "0",
                borderBottom:
                  idx < order.items.length - 1
                    ? "1px solid var(--surface-subtle, #efeee8)"
                    : "none",
              }}
            >
              {/* Product Thumbnail */}
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "var(--surface-subtle, #efeee8)",
                  border: "1px solid var(--border, #d4d5cc)",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                <ProductPhoto image={item.image} sizes="72px" priority />
              </div>

              {/* Product Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    margin: "0 0 0.25rem",
                    fontSize: "0.975rem",
                    fontWeight: 600,
                    color: "var(--foreground, #242922)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.name}
                </h3>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.8125rem",
                    color: "var(--muted-foreground, #62675c)",
                  }}
                >
                  {item.size && (
                    <span
                      style={{
                        padding: "0.15rem 0.45rem",
                        backgroundColor: "var(--surface-subtle, #efeee8)",
                        borderRadius: "4px",
                        fontWeight: 600,
                      }}
                    >
                      Size {item.size}
                    </span>
                  )}
                  <span>{item.quantity} produk</span>
                </div>
              </div>

              {/* Item Price */}
              <div
                style={{
                  textAlign: "right",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "var(--foreground, #242922)",
                  flexShrink: 0,
                }}
              >
                {formatIdr(item.total)}
              </div>
            </li>
          ))}
        </ul>

        {/* Pricing Breakdown DL */}
        <div
          style={{
            marginTop: "1.75rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid var(--border, #d4d5cc)",
          }}
        >
          <dl
            style={{
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.625rem",
              fontSize: "0.925rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <dt style={{ color: "var(--muted-foreground, #62675c)" }}>
                Subtotal Produk
              </dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>
                {formatIdr(order.merchandiseTotal)}
              </dd>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <dt
                style={{
                  color: "var(--muted-foreground, #62675c)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <ShippingIcon size={15} />
                <span>Ongkos Kirim</span>
              </dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>
                {order.shipping === 0 ? (
                  <span style={{ color: "#16a34a", fontWeight: 700 }}>
                    GRATIS
                  </span>
                ) : (
                  formatIdr(order.shipping)
                )}
              </dd>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "1rem",
                marginTop: "0.5rem",
                borderTop: "2px solid var(--foreground, #242922)",
                fontSize: "1.125rem",
              }}
            >
              <dt
                style={{ fontWeight: 700, color: "var(--foreground, #242922)" }}
              >
                Total Tagihan
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontWeight: 800,
                  fontSize: "1.25rem",
                  color: "var(--primary, #354a37)",
                  fontFamily: "var(--font-display, Georgia, serif)",
                }}
              >
                {formatIdr(order.total)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Bottom Footer Assurance & Action */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "1.25rem",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.875rem",
            color: "var(--muted-foreground, #62675c)",
          }}
        >
          <ShieldCheckIcon size={18} style={{ color: "#16a34a" }} />
          <span>
            Pesanan Anda dilindungi jaminan keamanan transaksi dan garansi
            keaslian deskripsi produk.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Link
            href="/products"
            className="button-primary"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.75rem",
            }}
          >
            Lanjut Belanja di Thrift Store
          </Link>
          <Link
            href="/"
            className="button-secondary"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.5rem",
            }}
          >
            Halaman Utama
          </Link>
        </div>
      </div>
    </main>
  );
}
