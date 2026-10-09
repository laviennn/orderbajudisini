import Link from "next/link";
import { Suspense } from "react";
import {
  readBanner,
  readCatalog,
  readCategories,
  storeForShell,
} from "@/server/services/storefront";
import { parseCatalog } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { ProductGrid } from "@/features/storefront/Products";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const s = await storeForShell();
  return pageMetadata(
    s.seo?.homepageTitle || s.seo?.siteTitle || s.name,
    s.seo?.homepageDescription ||
      s.seo?.defaultDescription ||
      "Katalog pakaian secondhand.",
    "/",
    s.seo?.defaultOgImage,
    false,
    s.seo,
  );
}
async function HomeContent() {
  const [banner, catalog, categories] = await Promise.all([
    readBanner(),
    readCatalog(parseCatalog({})),
    readCategories(),
  ]);
  return (
    <>
      {banner && (banner.headline || banner.image) ? (
        <section className={`home-banner ${banner.image ? "with-image" : ""}`}>
          <div>
            <p className="eyebrow">Koleksi toko</p>
            <h1>{banner.headline || "Katalog pakaian"}</h1>
            {banner.body && <p className="prose-copy">{banner.body}</p>}
            {banner.ctaLabel && banner.ctaUrl && (
              <Link className="primary-action" href={banner.ctaUrl}>
                {banner.ctaLabel}
              </Link>
            )}
          </div>
          {banner.image && (
            <picture>
              {banner.mobileImage && (
                <source
                  media="(max-width: 767px)"
                  srcSet={banner.mobileImage}
                />
              )}
              <img
                src={banner.image}
                alt={banner.headline || ""}
                width="1440"
                height="960"
                fetchPriority="high"
              />
            </picture>
          )}
        </section>
      ) : (
        <section className="home-intro">
          <div>
            <p className="eyebrow">Katalog pakaian secondhand</p>
            <h1>Lihat koleksi terbaru.</h1>
          </div>
          <p>Pilih produk, lalu periksa ukuran, kondisi, dan detailnya.</p>
        </section>
      )}
      <section className="section-space">
        <div className="section-heading">
          <h2>Baru ditambahkan</h2>
          <Link className="text-link" href="/products">
            Lihat semua
          </Link>
        </div>
        {catalog.items.length ? (
          <ProductGrid
            products={catalog.items.slice(0, 8)}
            listName="Produk terbaru"
          />
        ) : (
          <div className="empty-state">
            <h3>Belum ada produk tersedia.</h3>
            <p>Koleksi akan tampil setelah produk dipublikasikan.</p>
          </div>
        )}
      </section>
      {categories.length > 0 && (
        <section className="category-discovery">
          <h2>Jelajahi kategori</h2>
          <div>
            {categories.map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`}>
                {c.name}
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="store-note">
        <h2>Perhatikan setiap detail.</h2>
        <p>
          Ukuran, kondisi, dan catatan cacat tercantum pada halaman produk jika
          tersedia.
        </p>
      </section>
    </>
  );
}
export default function Home() {
  return (
    <main id="main-content" className="page-width">
      <Suspense
        fallback={
          <div className="section-space" role="status">
            Memuat koleksi…
          </div>
        }
      >
        <HomeContent />
      </Suspense>
    </main>
  );
}
