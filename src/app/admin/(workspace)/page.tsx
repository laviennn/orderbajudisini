import Link from "next/link";
import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import {
  catalogDashboard,
  adminProductList,
} from "@/server/services/admin-products";
import { availabilityLabel } from "@/lib/catalog";
export default async function Dashboard() {
  const actor = await requirePermission("admin.access");
  if (!hasPermission(actor, "products.read"))
    return (
      <main id="main-content">
        <h1>Administrasi toko</h1>
        <p>Modul untuk izin akun Anda belum tersedia.</p>
      </main>
    );
  const [counts, recent] = await Promise.all([
    catalogDashboard(),
    adminProductList({}),
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
      <div className="section-heading">
        <h2>Terakhir diperbarui</h2>
        <Link className="text-link" href="/admin/products">
          Semua produk
        </Link>
      </div>
      <ul className="admin-recent">
        {recent.items.slice(0, 8).map((p) => (
          <li key={p.id}>
            <Link href={`/admin/products/${p.id}/edit`}>{p.name}</Link>
            <span>{p.sku}</span>
          </li>
        ))}
      </ul>
      {!recent.items.length && (
        <p>Belum ada produk. Mulai dari kategori, lalu buat produk pertama.</p>
      )}
    </main>
  );
}
