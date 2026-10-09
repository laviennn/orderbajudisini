import { Metadata } from "next";
import Link from "next/link";
import { getAdminOrders } from "@/server/services/admin-orders";
import { requirePermission } from "@/server/auth/authorize";
import { formatIdr } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Daftar Pesanan" };

const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);

const statusLabels: Record<string, string> = {
  pending_payment: "Menunggu Pembayaran",
  payment_submitted: "Pembayaran Diserahkan",
  payment_verified: "Pembayaran Terverifikasi",
  processing: "Sedang Diproses",
  shipped: "Dalam Pengiriman",
  completed: "Pesanan Selesai",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

export default async function AdminOrdersPage(props: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requirePermission("orders.read");

  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1", 10);
  const status = searchParams.status;

  const data = await getAdminOrders({ page, status });

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Pesanan</h1>
      </header>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Order ID</th>
              <th>Pembeli</th>
              <th>Total</th>
              <th>Status</th>
              <th>Kurir</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td>{formatDateTime(item.createdAt)}</td>
                <td>
                  <Link href={`/admin/orders/${item.id}`}>
                    {item.orderNumber}
                  </Link>
                </td>
                <td>{item.addressSnapshot?.recipientName || "-"}</td>
                <td>{formatIdr(item.grandTotal)}</td>
                <td>{statusLabels[item.status] || item.status}</td>
                <td>
                  {item.shippingCourier} - {item.shippingService}
                </td>
                <td>
                  <Link href={`/admin/orders/${item.id}`} className="text-link">
                    Detail
                  </Link>
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  Tidak ada pesanan ditemukan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
