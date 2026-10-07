import Link from "next/link";
import { catalogUrl, type CatalogFilter } from "@/lib/catalog";
import {
  readCatalog,
  readCategories,
  readFacets,
} from "@/server/services/storefront";
import { Drawer } from "./Interactions";
import { Pagination, ProductGrid } from "./Products";
export async function Catalog({
  filters,
  path = "/products",
  title = "Semua produk",
  description,
}: {
  filters: CatalogFilter;
  path?: string;
  title?: string;
  description?: string | null;
}) {
  const [result, categories, facets] = await Promise.all([
    readCatalog(filters),
    readCategories(),
    readFacets(filters.category),
  ]);
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) =>
      [
        "q",
        "category",
        "size",
        "condition",
        "min",
        "max",
        "availability",
      ].includes(key) &&
      value !== "" &&
      value !== undefined &&
      !(key === "availability" && value === "active") &&
      !(key === "category" && path.startsWith("/category/")),
  );
  const labels: Record<string, string> = {
    q: "Pencarian",
    category: "Kategori",
    size: "Ukuran",
    condition: "Kondisi",
    min: "Harga min.",
    max: "Harga maks.",
    availability: "Status",
  };
  const form = (
    <form action={path} className="filter-form">
      <label>
        Cari produk
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Nama, merek, atau SKU"
          maxLength={80}
        />
      </label>
      {!path.startsWith("/category/") && categories.length > 0 && (
        <label>
          Kategori
          <select name="category" defaultValue={filters.category}>
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {facets.sizes.length > 0 && (
        <label>
          Ukuran
          <select name="size" defaultValue={filters.size}>
            <option value="">Semua ukuran</option>
            {facets.sizes.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      {facets.conditions.length > 0 && (
        <label>
          Kondisi
          <select name="condition" defaultValue={filters.condition}>
            <option value="">Semua kondisi</option>
            {facets.conditions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        Ketersediaan
        <select name="availability" defaultValue={filters.availability}>
          <option value="active">Tersedia</option>
          <option value="sold">Terjual</option>
          <option value="reserved">Sedang dipesan</option>
          <option value="all">Semua produk publik</option>
        </select>
      </label>
      {facets.hasPrices && (
        <div className="price-inputs">
          <label>
            Harga min. (Rp)
            <input
              type="number"
              name="min"
              min="0"
              defaultValue={filters.min}
            />
          </label>
          <label>
            Harga maks. (Rp)
            <input
              type="number"
              name="max"
              min="0"
              defaultValue={filters.max}
            />
          </label>
        </div>
      )}
      <label>
        Urutkan
        <select name="sort" defaultValue={filters.sort}>
          <option value="newest">Terbaru</option>
          <option value="price-asc">Harga terendah</option>
          <option value="price-desc">Harga tertinggi</option>
        </select>
      </label>
      <button className="primary-action">Terapkan</button>
      <Link className="text-link" href={path}>
        Hapus semua filter
      </Link>
    </form>
  );
  return (
    <main id="main-content" className="page-width section-space">
      <div className="catalog-heading">
        <p className="eyebrow">Katalog</p>
        <h1>{title}</h1>
        {description && <p className="prose-copy">{description}</p>}
      </div>
      <div className="catalog-layout">
        <aside className="desktop-filters" aria-label="Filter produk">
          {form}
        </aside>
        <div>
          <div className="mobile-filters">
            <Drawer label="Cari, filter & urutkan" title="Filter produk">
              {form}
            </Drawer>
          </div>
          {activeFilters.length > 0 && (
            <nav className="active-filters" aria-label="Filter aktif">
              {activeFilters.map(([key, value]) => (
                <Link
                  key={key}
                  href={catalogUrl(path, filters, {
                    [key]:
                      key === "availability"
                        ? "active"
                        : key === "min" || key === "max"
                          ? undefined
                          : "",
                    page: 1,
                  })}
                  aria-label={`Hapus filter ${labels[key]} ${value}`}
                >
                  {labels[key]}: {value} ×
                </Link>
              ))}
            </nav>
          )}
          <p className="small-note results-note">
            {result.items.length} produk pada halaman ini
            {filters.q ? ` untuk “${filters.q}”` : ""}
          </p>
          <h2 className="sr-only">Hasil produk</h2>
          <ProductGrid products={result.items} priorityFirst />
          <Pagination path={path} filters={filters} hasNext={result.hasNext} />
        </div>
      </div>
    </main>
  );
}
