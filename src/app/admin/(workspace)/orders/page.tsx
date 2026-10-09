import Link from "next/link";
import { getAdminOrders } from "@/server/services/admin-orders";
import { formatIdr } from "@/lib/domain/money";
import { orderLabels, paymentLabels, dateTime } from "@/lib/admin-operations";
import { AdminPagination } from "@/features/admin/Pagination";
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const data = await getAdminOrders(await searchParams);
  return (
    <main id="main-content">
      <h1>Pesanan</h1>
      <form className="admin-filters" action="/admin/orders">
        <label>
          Cari nomor pesanan / penerima
          <input name="q" maxLength={80} defaultValue={data.q} />
        </label>
        <label>
          Status pesanan
          <select name="status" defaultValue={data.status}>
            <option value="">Semua status</option>
            {Object.entries(orderLabels).map(([value, label]) => (
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
        aria-label="Daftar pesanan"
        tabIndex={0}
      >
        <table className="admin-table">
          <thead>
            <tr>
              {[
                "Pesanan",
                "Penerima",
                "Total",
                "Status",
                "Pembayaran",
                "Pengiriman",
              ].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/admin/orders/${item.id}`}>
                    {item.orderNumber}
                  </Link>
                  <br />
                  {dateTime(item.createdAt)}
                </td>
                <td>{item.addressSnapshot.recipientName}</td>
                <td>{formatIdr(item.grandTotal)}</td>
                <td>{orderLabels[item.status]}</td>
                <td>
                  {item.paymentStatus ? paymentLabels[item.paymentStatus] : "—"}
                </td>
                <td>
                  {item.shippingCourier} {item.shippingService}
                  <br />
                  {item.trackingNumber ?? "Belum ada resi"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.items.length && (
        <p className="empty-state">Tidak ada pesanan yang sesuai.</p>
      )}
      <AdminPagination
        path="/admin/orders"
        {...data}
        filters={{ q: data.q, status: data.status }}
      />
    </main>
  );
}
