import Link from "next/link";
import {
  adminProductList,
  adminCategories,
} from "@/server/services/admin-products";
import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import { formatIdr } from "@/lib/domain/money";
import { ProductPhoto } from "@/features/storefront/Interactions";
export default async function Products({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission("products.read");
  const params = await searchParams;
  const input = Object.fromEntries(
    Object.entries(params).filter(([, v]) => typeof v === "string"),
  );
  const [result, categories] = await Promise.all([
    adminProductList(input),
    hasPermission(actor, "categories.read") ? adminCategories() : [],
  ]);
  const href = (page: number) => {
    const query = new URLSearchParams(input as Record<string, string>);
    query.set("page", String(page));
    return `/admin/products?${query}`;
  };
  return (
    <main id="main-content">
      <div className="section-heading">
        <h1>Produk</h1>
        {hasPermission(actor, "products.create") && (
          <Link className="primary-action" href="/admin/products/new">
            Tambah produk
          </Link>
        )}
      </div>
      <form className="admin-filters" action="/admin/products">
        <label>
          Cari nama / SKU
          <input name="q" maxLength={80} defaultValue={String(input.q ?? "")} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={String(input.status ?? "")}>
            <option value="">Semua status</option>
            {["draft", "active", "reserved", "sold", "archived"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Kategori
          <select name="category" defaultValue={String(input.category ?? "")}>
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bundle
          <select name="eligible" defaultValue={String(input.eligible ?? "")}>
            <option value="">Semua</option>
            <option value="yes">Eligible</option>
            <option value="no">Tidak eligible</option>
          </select>
        </label>
        <button className="primary-action">Terapkan</button>
      </form>
      <div
        className="admin-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Daftar produk"
      >
        <table className="admin-table">
          <thead>
            <tr>
              {[
                "Foto",
                "Produk / SKU",
                "Kategori",
                "Ukuran",
                "Harga",
                "Status",
                "Stok",
                "Diperbarui",
                "Tindakan",
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.items.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="admin-thumbnail">
                    <ProductPhoto image={p.image} sizes="56px" />
                  </div>
                </td>
                <td>
                  <strong>{p.name}</strong>
                  <br />
                  <span className="small-note">{p.sku}</span>
                </td>
                <td>{p.category}</td>
                <td>{p.sizeLabel || "—"}</td>
                <td>{formatIdr(p.price)}</td>
                <td>{p.status}</td>
                <td>{p.quantity}</td>
                <td>
                  {p.updatedAt.toLocaleDateString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}
                </td>
                <td>
                  <Link
                    className="text-link"
                    href={`/admin/products/${p.id}/edit`}
                  >
                    Edit
                  </Link>
                  <Link
                    className="text-link"
                    href={`/admin/products/${p.id}/preview`}
                  >
                    Preview
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!result.items.length && (
        <p className="empty-state">Tidak ada produk yang sesuai.</p>
      )}
      <nav className="pagination" aria-label="Halaman produk admin">
        {result.page > 1 && (
          <Link href={href(result.page - 1)}>Sebelumnya</Link>
        )}
        <span>Halaman {result.page}</span>
        {result.hasNext && <Link href={href(result.page + 1)}>Berikutnya</Link>}
      </nav>
    </main>
  );
}
