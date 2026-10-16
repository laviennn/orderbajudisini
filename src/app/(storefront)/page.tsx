import Image from "next/image";
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
  const [s, banner] = await Promise.all([storeForShell(), readBanner()]);
  const defaultImage =
    banner?.image || banner?.mobileImage || s.seo?.defaultOgImage;
  return pageMetadata(
    s.seo?.homepageTitle || s.seo?.siteTitle || s.name,
    s.seo?.homepageDescription ||
      s.seo?.defaultDescription ||
      "Katalog pakaian secondhand.",
    "/",
    defaultImage,
    false,
    s.seo,
  );
}
async function HomeContent() {
  const [banner, catalog, categories, store] = await Promise.all([
    readBanner(),
    readCatalog(parseCatalog({})),
    readCategories(),
    storeForShell(),
  ]);

  const bannerAlt =
    banner?.headline || `${store.name} - Koleksi Busana Muslimah`;

  return (
    <>
      <h1 className="sr-only">
        {banner?.headline || `${store.name} - Koleksi Busana Muslimah`}
      </h1>

      {banner?.image && (
        <section
          className="boutique-hero-banner"
          aria-label="Selamat datang di toko"
        >
          <div className="hero-banner-frame">
            {banner.ctaUrl ? (
              <Link href={banner.ctaUrl} className="hero-banner-link">
                <Image
                  src={banner.image}
                  alt={bannerAlt}
                  width={1200}
                  height={620}
                  priority
                  sizes="100vw"
                  className="hero-banner-image"
                  unoptimized
                />
              </Link>
            ) : (
              <Image
                src={banner.image}
                alt={bannerAlt}
                width={1200}
                height={620}
                priority
                sizes="100vw"
                className="hero-banner-image"
                unoptimized
              />
            )}
          </div>
        </section>
      )}

      <div className="page-width">
        <section className="section-space">
          <div className="section-heading">
            <h2>Lihat koleksi terbaru.</h2>
            <Link className="text-link" href="/products">
              Lihat semua
            </Link>
          </div>
          {catalog.items.length ? (
            <ProductGrid
              products={catalog.items.slice(0, 8)}
              listName="Produk terbaru"
              priorityFirst
            />
          ) : (
            <div className="empty-state">
              <h3>Belum ada produk tersedia.</h3>
              <p>Koleksi akan tampil setelah produk dipublikasikan di admin.</p>
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
      </div>
    </>
  );
}
export default function Home() {
  return (
    <main id="main-content">
      <Suspense
        fallback={
          <div className="section-space page-width" role="status">
            Memuat koleksi…
          </div>
        }
      >
        <HomeContent />
      </Suspense>
    </main>
  );
}
