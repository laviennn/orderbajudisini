import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaymentDetail } from "@/server/services/admin-payments";
import { requirePermission } from "@/server/auth/authorize";
import { formatIdr } from "@/lib/domain/money";
import { hasPermission } from "@/server/auth/policy";
import { paymentLabels, orderLabels } from "@/lib/admin-operations";
import PaymentActions from "./PaymentActions";

const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);

export const metadata: Metadata = { title: "Detail Pembayaran" };

export default async function PaymentDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePermission("payments.read");

  const params = await props.params;

  let data;
  try {
    data = await getPaymentDetail(params.id);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "NOT_FOUND"
    )
      notFound();
    throw err;
  }

  const { payment, order, orderItems, history } = data;

  return (
    <main id="main-content" className="admin-page">
      <header
        className="page-header"
        style={{ display: "flex", gap: "1rem", alignItems: "center" }}
      >
        <Link href="/admin/payments" className="text-link">
          &larr; Kembali
        </Link>
        <h1>Detail Pembayaran</h1>
      </header>

      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2>Informasi Pesanan</h2>
        <dl className="property-list">
          <div>
            <dt>ID Pesanan</dt>
            <dd>{order.orderNumber}</dd>
          </div>
          <div>
            <dt>Nama Pembeli</dt>
            <dd>{order.addressSnapshot.recipientName}</dd>
          </div>
          <div>
            <dt>Alamat Pengiriman</dt>
            <dd>
              {order.addressSnapshot.addressLine},{" "}
              {order.addressSnapshot.district}, {order.addressSnapshot.city},{" "}
              {order.addressSnapshot.province},{" "}
              {order.addressSnapshot.postalCode}
            </dd>
          </div>
          <div>
            <dt>Kurir</dt>
            <dd>
              {order.shippingCourier} - {order.shippingService}
            </dd>
          </div>
        </dl>
      </div>

      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2>Ringkasan Biaya</h2>
        <dl className="property-list">
          <div>
            <dt>Subtotal Produk</dt>
            <dd>{formatIdr(order.merchandiseTotal)}</dd>
          </div>
          {order.discountTotal > 0 && (
            <div>
              <dt>Diskon Promosi</dt>
              <dd>-{formatIdr(order.discountTotal)}</dd>
            </div>
          )}
          <div>
            <dt>Ongkos Kirim</dt>
            <dd>{formatIdr(order.shippingCost)}</dd>
          </div>
          <div style={{ fontWeight: "bold" }}>
            <dt>Total Pesanan</dt>
            <dd>{formatIdr(order.grandTotal)}</dd>
          </div>
        </dl>
      </div>

      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2>Produk</h2>
        <div
          className="admin-table-scroll"
          role="region"
          aria-label="Produk pembayaran"
          tabIndex={0}
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Varian</th>
                <th>Harga</th>
                <th>Kuantitas</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((item, i) => (
                <tr key={i}>
                  <td>{item.nameSnapshot}</td>
                  <td>
                    {item.sizeSnapshot}{" "}
                    {item.conditionSnapshot
                      ? `(${item.conditionSnapshot})`
                      : ""}
                  </td>
                  <td>{formatIdr(item.priceSnapshot)}</td>
                  <td>{item.quantity}</td>
                  <td>{formatIdr(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2>Bukti Pembayaran</h2>
        <dl className="property-list" style={{ marginBottom: "1rem" }}>
          <div>
            <dt>Status</dt>
            <dd>
              <span
                className={`status-badge status-${paymentLabels[payment.status]}`}
              >
                {paymentLabels[payment.status]}
              </span>
            </dd>
          </div>
          {payment.method === "bank_transfer" && payment.bankSnapshot ? (
            <div>
              <dt>Bank Tujuan</dt>
              <dd>
                {payment.bankSnapshot.bankName} -{" "}
                {payment.bankSnapshot.accountNumber} (
                {payment.bankSnapshot.accountHolder})
              </dd>
            </div>
          ) : payment.method === "qris" && payment.qrisSnapshot ? (
            <div>
              <dt>Metode</dt>
              <dd>
                QRIS{" "}
                {payment.qrisSnapshot.merchantName
                  ? `(${payment.qrisSnapshot.merchantName})`
                  : ""}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Waktu Submit</dt>
            <dd>
              {payment.submittedAt
                ? formatDateTime(payment.submittedAt)
                : "Belum submit"}
            </dd>
          </div>
          {payment.rejectionReason && (
            <div>
              <dt>Alasan Penolakan</dt>
              <dd style={{ color: "var(--error)" }}>
                {payment.rejectionReason}
              </dd>
            </div>
          )}
        </dl>

        {payment.hasProof && (
          <div
            style={{
              marginTop: "1rem",
              border: "1px solid #ddd",
              padding: "1rem",
              borderRadius: "4px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/admin/payments/${payment.id}/proof`}
              alt="Bukti Pembayaran"
              style={{
                maxWidth: "100%",
                maxHeight: "500px",
                display: "block",
                margin: "0 auto",
              }}
            />
          </div>
        )}
      </div>

      <section>
        <h2>Hasil pemeriksaan</h2>
        <p>{paymentLabels[payment.status]}</p>
        {payment.verifiedAt && (
          <p>
            Diverifikasi {formatDateTime(payment.verifiedAt)} oleh{" "}
            {payment.verifier ?? "Staf"}.
          </p>
        )}
        {hasPermission(actor, "orders.read") && (
          <Link className="text-link" href={`/admin/orders/${order.id}`}>
            Buka pesanan
          </Link>
        )}
        <h2>Riwayat pesanan</h2>
        <ol className="admin-recent">
          {history.map((row) => (
            <li key={row.id}>
              {formatDateTime(row.createdAt)} · {orderLabels[row.to]}
            </li>
          ))}
        </ol>
      </section>
      {payment.status === "submitted" &&
        hasPermission(actor, "payments.verify") && (
          <div className="card">
            <h2>Tindakan</h2>
            <PaymentActions paymentId={payment.id} />
          </div>
        )}
    </main>
  );
}
