import Link from "next/link";
import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import {
  catalogDashboard,
  adminProductList,
} from "@/server/services/admin-products";
import { availabilityLabel } from "@/lib/catalog";
import { getAdminOrders } from "@/server/services/admin-orders";
import { formatIdr } from "@/lib/domain/money";
export default async function Dashboard() {
  const actor = await requirePermission("admin.access");
  if (!hasPermission(actor, "products.read"))
    return (
      <main id="main-content">
        <h1>Administrasi toko</h1>
        <p>Modul untuk izin akun Anda belum tersedia.</p>
      </main>
    );
  const [
    counts,
    recentProducts,
    pendingPayments,
    processingOrders,
    recentOrders,
  ] = await Promise.all([
    catalogDashboard(),
    adminProductList({}),
    getAdminOrders({ status: "submitted", pageSize: 5 }),
    getAdminOrders({ status: "processing", pageSize: 5 }),
    getAdminOrders({ pageSize: 5 }),
  ]);
  return (
    <main id="main-content">
      <h1>Ringkasan katalog</h1>
      <dl className="admin-counts">
        {["active", "draft", "sold", "archived"].map((status) => (
          <div key={status}>
            <dt>
              {status === "draft"
                ? "Draft"
                : status === "archived"
                  ? "Arsip"
                  : availabilityLabel[status as "active"]}
            </dt>
            <dd>{counts.find((c) => c.status === status)?.count ?? 0}</dd>
          </div>
        ))}
      </dl>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2rem",
          marginTop: "2rem",
        }}
      >
        <div>
          <div className="section-heading">
            <h2>Pesanan Terakhir</h2>
            <Link className="text-link" href="/admin/orders">
              Semua pesanan
            </Link>
          </div>
          <ul className="admin-recent">
            {recentOrders.items.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link>
                <span>{formatIdr(o.grandTotal)}</span>
              </li>
            ))}
          </ul>
          {!recentOrders.items.length && <p>Belum ada pesanan.</p>}

          <div className="section-heading" style={{ marginTop: "2rem" }}>
            <h2>Menunggu Pembayaran</h2>
            <Link className="text-link" href="/admin/payments">
              Verifikasi
            </Link>
          </div>
          <ul className="admin-recent">
            {pendingPayments.items.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link>
                <span>Menunggu diverifikasi</span>
              </li>
            ))}
          </ul>
          {!pendingPayments.items.length && <p>Antrean verifikasi kosong.</p>}
        </div>

        <div>
          <div className="section-heading">
            <h2>Produk Terakhir</h2>
            <Link className="text-link" href="/admin/products">
              Semua produk
            </Link>
          </div>
          <ul className="admin-recent">
            {recentProducts.items.slice(0, 5).map((p) => (
              <li key={p.id}>
                <Link href={`/admin/products/${p.id}/edit`}>{p.name}</Link>
                <span>{p.sku}</span>
              </li>
            ))}
          </ul>
          {!recentProducts.items.length && (
            <p>
              Belum ada produk. Mulai dari kategori, lalu buat produk pertama.
            </p>
          )}

          <div className="section-heading" style={{ marginTop: "2rem" }}>
            <h2>Antrean Pengiriman</h2>
            <Link className="text-link" href="/admin/shipments">
              Kirim pesanan
            </Link>
          </div>
          <ul className="admin-recent">
            {processingOrders.items.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`}>{o.orderNumber}</Link>
                <span>
                  {o.shippingCourier} {o.shippingService}
                </span>
              </li>
            ))}
          </ul>
          {!processingOrders.items.length && (
            <p>Semua pesanan sudah dikirim.</p>
          )}
        </div>
      </div>
    </main>
  );
}
