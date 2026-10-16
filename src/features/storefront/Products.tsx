import Link from "next/link";
import { catalogUrl, type CatalogFilter } from "@/lib/catalog";
import type { CatalogProduct } from "@/server/repositories/catalog";
import { AnalyticsView, InteractiveProductCard } from "./Interactions";

export function ProductGrid({
  products,
  listName = "Produk",
  priorityFirst = false,
}: {
  products: CatalogProduct[];
  listName?: string;
  priorityFirst?: boolean;
}) {
  if (!products.length)
    return (
      <div className="empty-state">
        <h2>Belum ada produk yang sesuai.</h2>
        <p>Coba kata pencarian atau filter lain.</p>
        <Link className="text-link" href="/products">
          Lihat semua produk
        </Link>
      </div>
    );
  return (
    <>
      <AnalyticsView event="view_item_list" ids={products.map((p) => p.id)} />
      <ul className="product-grid boutique-grid" aria-label={listName}>
        {products.map((p, index) => (
          <li key={p.id}>
            <InteractiveProductCard
              product={p}
              priority={priorityFirst && index === 0}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
export function Pagination({
  path,
  filters,
  hasNext,
}: {
  path: string;
  filters: CatalogFilter;
  hasNext: boolean;
}) {
  if (filters.page === 1 && !hasNext) return null;
  return (
    <nav className="pagination" aria-label="Halaman katalog">
      {filters.page > 1 ? (
        <Link
          className="text-link"
          href={catalogUrl(path, filters, { page: filters.page - 1 })}
        >
          Sebelumnya
        </Link>
      ) : (
        <span />
      )}
      <span>Halaman {filters.page}</span>
      {hasNext && filters.page < 1000 && (
        <Link
          className="text-link"
          href={catalogUrl(path, filters, { page: filters.page + 1 })}
        >
          Berikutnya
        </Link>
      )}
    </nav>
  );
}
export function CatalogSkeleton() {
  return (
    <main
      id="main-content"
      className="page-width section-space"
      aria-busy="true"
      aria-label="Memuat katalog"
    >
      <p>Memuat produk…</p>
      <div className="product-grid">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="product-photo skeleton" />
        ))}
      </div>
    </main>
  );
}
