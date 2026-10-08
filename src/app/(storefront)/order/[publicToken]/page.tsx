import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { publicOrder } from "@/server/services/checkout";
import { formatIdr } from "@/lib/domain/money";
import { ProductPhoto } from "@/features/storefront/Interactions";
import { PaymentProofUpload } from "@/features/checkout/PaymentProofUpload";
import { WhatsAppConfirmation } from "@/features/checkout/WhatsAppConfirmation";

export const metadata: Metadata = {
  title: "Status Pesanan - Thrift Commerce",
  robots: {
    index: false,
    follow: false,
  },
};

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

  return (
    <main className="section-space page-width">
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <header style={{ marginBottom: "2.5rem", textAlign: "center" }}>
          <h1 style={{ marginBottom: "0.5rem" }}>Pesanan Diterima</h1>
          <p className="small-note" style={{ fontSize: "1rem" }}>Nomor Pesanan: {order.orderNumber}</p>
        </header>

        <div className="cart-summary" style={{ borderTop: "none", backgroundColor: "var(--surface-subtle)", padding: "2rem", borderRadius: "var(--radius-control)", marginBottom: "2rem" }}>
          <h2>Status Pembayaran</h2>
          <p>
            {order.status === "pending_payment" && order.payment?.status !== "rejected" && "Menunggu Pembayaran"}
            {order.status === "pending_payment" && order.payment?.status === "rejected" && "Pembayaran Ditolak. Silakan unggah ulang bukti transfer yang valid."}
            {order.status === "payment_submitted" && "Bukti pembayaran telah diterima dan sedang menunggu verifikasi."}
            {order.status === "payment_verified" && "Pembayaran Terverifikasi - Menunggu Diproses"}
            {order.status === "processing" && "Pesanan Sedang Diproses"}
            {order.status === "shipped" && "Pesanan Telah Dikirim"}
            {order.status === "cancelled" && "Pesanan Dibatalkan"}
            {order.status === "completed" && "Pesanan Selesai"}
          </p>
          {(order.status === "pending_payment" || order.status === "payment_submitted") && order.paymentMethod === 'bank_transfer' && order.bank && (
            <div style={{ marginTop: "1.5rem" }}>
              <p>Silakan lakukan transfer ke rekening berikut:</p>
              <div style={{ padding: "1rem", backgroundColor: "var(--surface-background)", borderRadius: "var(--radius-control)", marginTop: "0.5rem" }}>
                <strong>{order.bank.bankName}</strong><br />
                {order.bank.accountNumber}<br />
                A.n. {order.bank.accountHolder}
              </div>
              {order.bank.instructions && (
                <p style={{ marginTop: "1rem" }}>{order.bank.instructions}</p>
              )}
              <p className="small-note" style={{ marginTop: "1rem" }}>Instruksi lebih lanjut akan dikirimkan ke WhatsApp {order.address.phone}.</p>
              
              {order.status === "pending_payment" && (
                <PaymentProofUpload publicToken={publicToken} />
              )}
              {order.status === "payment_submitted" && (
                <WhatsAppConfirmation publicToken={publicToken} />
              )}
            </div>
          )}

          {(order.status === "pending_payment" || order.status === "payment_submitted") && order.paymentMethod === 'qris' && order.qris && (
            <div style={{ marginTop: "1.5rem" }}>
              <p>Silakan lakukan scan QRIS berikut:</p>
              <div style={{ padding: "1rem", backgroundColor: "var(--surface-background)", borderRadius: "var(--radius-control)", marginTop: "0.5rem", textAlign: "center" }}>
                {order.qris.merchantName && <strong>{order.qris.merchantName}</strong>}
                {order.qris.imageUrl && (
                  <div style={{ marginTop: "1rem" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.qris.imageUrl}
                      alt={order.qris.merchantName || "QRIS"}
                      style={{ maxWidth: "100%", maxHeight: "300px", objectFit: "contain", margin: "0 auto", display: "block" }}
                    />
                  </div>
                )}
              </div>
              {order.qris.instructions && (
                <p style={{ marginTop: "1rem" }}>{order.qris.instructions}</p>
              )}
              <p className="small-note" style={{ marginTop: "1rem" }}>Instruksi lebih lanjut akan dikirimkan ke WhatsApp {order.address.phone}.</p>
              
              {order.status === "pending_payment" && (
                <PaymentProofUpload publicToken={publicToken} />
              )}
              {order.status === "payment_submitted" && (
                <WhatsAppConfirmation publicToken={publicToken} />
              )}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
          <div>
            <h3>Alamat Pengiriman</h3>
            <address style={{ fontStyle: "normal", color: "var(--muted-foreground)" }}>
              <strong>{order.address.recipientName}</strong><br />
              {order.address.phone}<br />
              {order.address.addressLine}<br />
              {order.address.subdistrict ? `${order.address.subdistrict}, ` : ""}
              {order.address.district}<br />
              {order.address.city}, {order.address.province} {order.address.postalCode}
            </address>
          </div>
          <div>
            <h3>Layanan Ekspedisi</h3>
            <p style={{ color: "var(--muted-foreground)", margin: 0 }}>
              {order.shippingDetails.courier} - {order.shippingDetails.service}
            </p>
            {order.shippingDetails.trackingNumber && (
              <p style={{ marginTop: "0.5rem", fontWeight: 500 }}>
                Resi: {order.shippingDetails.trackingNumber}
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 style={{ borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>Ringkasan Produk</h3>
          <ul className="cart-lines">
            {order.items.map((item, idx) => (
              <li key={idx}>
                <div className="cart-photo">
                  <ProductPhoto image={null} sizes="80px" />
                </div>
                <div>
                  <h4 style={{ margin: "0 0 0.25rem", fontSize: "1rem", fontWeight: "normal" }}>{item.name}</h4>
                  <p className="small-note">1 produk</p>
                </div>
                <span>
                  {formatIdr(item.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="cart-summary" style={{ marginTop: "1.5rem" }}>
          <dl>
            <div>
              <dt>Total produk</dt>
              <dd>{formatIdr(order.merchandiseTotal)}</dd>
            </div>
            <div>
              <dt>Ongkos kirim</dt>
              <dd>{formatIdr(order.shipping)}</dd>
            </div>
            <div className="cart-total" style={{ fontSize: "1.25rem", marginTop: "0.5rem", paddingTop: "1rem" }}>
              <dt>Total tagihan</dt>
              <dd>{formatIdr(order.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </main>
  );
}
