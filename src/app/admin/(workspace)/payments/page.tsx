import Link from "next/link";
import { getPaymentQueue } from "@/server/services/admin-payments";
import { formatIdr } from "@/lib/domain/money";
import { paymentLabels, dateTime } from "@/lib/admin-operations";
import { AdminPagination } from "@/features/admin/Pagination";
export default async function PaymentQueue({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const data = await getPaymentQueue(await searchParams);
  return (
    <main id="main-content">
      <h1>Pembayaran</h1>
      <p>Periksa bukti dan tujuan transfer sebelum memverifikasi pembayaran.</p>
      <form className="admin-filters" action="/admin/payments">
        <label>
          Cari nomor pesanan / penerima
          <input name="q" maxLength={80} defaultValue={data.q} />
        </label>
        <label>
          Status pembayaran
          <select name="status" defaultValue={data.status}>
            <option value="">Semua status</option>
            {Object.entries(paymentLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-action">Terapkan</button>
      </form>
      <div
        className="admin-table-scroll"
        role="region"
        aria-label="Daftar pembayaran"
        tabIndex={0}
      >
        <table className="admin-table">
          <thead>
            <tr>
              {["Pesanan", "Penerima", "Jumlah", "Status", "Bukti dikirim"].map(
                (label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.paymentId}>
                <td>
                  <Link href={`/admin/payments/${item.paymentId}`}>
                    {item.orderNumber}
                  </Link>
                </td>
                <td>{item.addressSnapshot.recipientName}</td>
                <td>{formatIdr(item.expectedAmount)}</td>
                <td>{paymentLabels[item.status]}</td>
                <td>{dateTime(item.submittedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.items.length && (
        <p className="empty-state">Tidak ada pembayaran yang sesuai.</p>
      )}
      <AdminPagination
        path="/admin/payments"
        {...data}
        filters={{ q: data.q, status: data.status }}
      />
    </main>
  );
}
