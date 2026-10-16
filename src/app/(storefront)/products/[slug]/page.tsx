import Link from "next/link";
import { notFound } from "next/navigation";
import {
  readProduct,
  readRelated,
  readReviews,
  readReviewSummary,
  readAdjacentProducts,
  storeForShell,
} from "@/server/services/storefront";
import { absoluteUrl, jsonLd, pageMetadata, seoTitle } from "@/lib/seo";
import { formatIdr } from "@/lib/domain/money";
import {
  AddToCart,
  AnalyticsView,
  Gallery,
  ProductPhoto,
  ProductSelectionProvider,
} from "@/features/storefront/Interactions";
import { ProductGrid } from "@/features/storefront/Products";
import { ProductReviews, StarIcon } from "@/features/storefront/ProductReviews";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reviews?: string }>;
};
export async function generateMetadata({ params }: Props) {
  const p = await readProduct((await params).slug);
  if (!p) return {};
  const store = await storeForShell();
  return pageMetadata(
    p.seoTitle || seoTitle(p.name, store.name, store.seo),
    p.seoDescription || p.shortDescription || p.description.slice(0, 160),
    `/products/${p.slug}`,
    p.images[0]?.url,
    false,
    store.seo,
  );
}
export default async function Product({ params, searchParams }: Props) {
  const p = await readProduct((await params).slug);
  if (!p) notFound();
  const rawPage = Number((await searchParams).reviews || 1);
  const page =
    Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 10000 ? rawPage : 1;
  const [reviews, summary, related, adjacent] = await Promise.all([
    readReviews(p.id, page),
    readReviewSummary(p.id),
    readRelated(p.id, p.categoryId),
    readAdjacentProducts(p.id, p.categoryId),
  ]);
  const breadcrumbs = [
    { name: "Beranda", path: "/" },
    { name: p.categoryName, path: `/category/${p.categorySlug}` },
    { name: p.name, path: `/products/${p.slug}` },
  ];
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    sku: p.sku,
    image: p.images.map((i) => i.url),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/products/${p.slug}`),
      price: p.price,
      priceCurrency: "IDR",
      itemCondition: "https://schema.org/UsedCondition",
      availability:
        p.status === "active"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
    ...(summary.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: summary.average,
            reviewCount: summary.count,
          },
        }
      : {}),
  };
  return (
    <main id="main-content" className="page-width product-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structured) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: breadcrumbs.map((b, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: b.name,
              item: absoluteUrl(b.path),
            })),
          }),
        }}
      />
      <AnalyticsView event="view_item" ids={[p.id]} />
      <div className="pdp-top-nav-bar">
        {adjacent.prev ? (
          <Link
            href={`/products/${adjacent.prev.slug}`}
            className="pdp-nav-link prev"
            aria-label={`Produk sebelumnya: ${adjacent.prev.name}`}
          >
            <span className="pdp-nav-icon">‹</span> Produk Sebelumnya
          </Link>
        ) : (
          <span className="pdp-nav-link disabled" aria-hidden="true">
            <span className="pdp-nav-icon">‹</span> Produk Sebelumnya
          </span>
        )}
        {adjacent.next ? (
          <Link
            href={`/products/${adjacent.next.slug}`}
            className="pdp-nav-link next"
            aria-label={`Produk berikutnya: ${adjacent.next.name}`}
          >
            Produk Berikutnya <span className="pdp-nav-icon">›</span>
          </Link>
        ) : (
          <span className="pdp-nav-link disabled" aria-hidden="true">
            Produk Berikutnya <span className="pdp-nav-icon">›</span>
          </span>
        )}
      </div>

      <nav aria-label="Breadcrumb" className="breadcrumbs">
        {breadcrumbs.map((b, i) =>
          i === 2 ? (
            <span key={b.path} aria-current="page">
              {b.name}
            </span>
          ) : (
            <Link key={b.path} href={b.path}>
              {b.name}
            </Link>
          ),
        )}
      </nav>

      <ProductSelectionProvider
        images={p.images}
        productId={p.id}
        productName={p.name}
        available={p.status === "active"}
      >
        <div className="product-detail">
          <Gallery images={p.images} name={p.name} />
          <section className="product-info">
            <h1 className="pdp-title">{p.name}</h1>
            {summary.count > 0 && (
              <a
                href="#reviews"
                className="pdp-rating-summary-pill"
                title="Lihat ulasan pembeli"
              >
                <span className="pdp-rating-stars-inline">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <StarIcon
                      key={i}
                      filled={i < Math.round(summary.average ?? 5)}
                      size={13}
                    />
                  ))}
                </span>
                <strong className="pdp-rating-score-inline">
                  {summary.average?.toFixed(1) ?? "5.0"}
                </strong>
                <span className="pdp-rating-count-inline">
                  ({summary.count} ulasan)
                </span>
              </a>
            )}
            <div className="pdp-divider" />
            <div className="pdp-pricing-banner">
              <div className="pdp-price-hero">
                <span className="pdp-hero-amount">Rp 100.000</span>
                <span className="pdp-hero-unit">/ 3 pcs</span>
              </div>
              <div className="pdp-sub-price-row">
                <span className="pdp-price pdp-unit-amount">
                  Satuan: {formatIdr(p.price)}
                </span>
                <span className="pdp-delivery-badge">
                  🚚 Bebas Ongkir min. 2 pcs
                </span>
              </div>
            </div>

            <div className="pdp-specs-block">
              {p.sizeLabel && (
                <p className="pdp-spec-line highlight">
                  <strong>Ukuran:</strong> {p.sizeLabel}
                </p>
              )}

              {p.conditionGrade && (
                <p className="pdp-spec-line">
                  <strong>Kondisi:</strong> {p.conditionGrade}
                </p>
              )}

              {p.weightGrams ? (
                <p className="pdp-spec-line">
                  <strong>Berat Produk:</strong> {p.weightGrams} gram
                </p>
              ) : null}

              {p.brand && (
                <p className="pdp-spec-line">
                  <strong>Merek:</strong> {p.brand}
                </p>
              )}

              <p className="pdp-spec-line">
                <strong>SKU:</strong> {p.sku}
              </p>
            </div>

            <div className="pdp-divider" />

            <div className="pdp-purchase-card">
              <AddToCart id={p.id} available={p.status === "active"} />

              <div className="pdp-trust-grid">
                <div className="pdp-trust-item">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>Sudah Dicuci & Higienis</span>
                </div>
                <div className="pdp-trust-item">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="1" y="3" width="15" height="13"></rect>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                    <circle cx="5.5" cy="18.5" r="2.5"></circle>
                    <circle cx="18.5" cy="18.5" r="2.5"></circle>
                  </svg>
                  <span>Bebas Ongkir min. 2 pcs</span>
                </div>
                <div className="pdp-trust-item">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-10 7L2 7" />
                  </svg>
                  <span>Transfer Manual Aman</span>
                </div>
              </div>
            </div>
            {Boolean(p.description) && (
              <section className="product-copy">
                <h2>Tentang produk</h2>
                <p>{p.description}</p>
              </section>
            )}
            {Boolean(p.conditionNotes) && (
              <section className="product-copy">
                <h2>Kondisi & catatan</h2>
                <p>{p.conditionNotes}</p>
                {p.defectNotes && (
                  <div className="defect-note">
                    <h3>Catatan cacat</h3>
                    <p>{p.defectNotes}</p>
                  </div>
                )}
              </section>
            )}
            {p.measurements.length > 0 && (
              <section className="product-copy">
                <h2>Ukuran aktual</h2>
                <dl className="measurements">
                  {p.measurements.map((m) => (
                    <div key={m.id}>
                      <dt>{m.label}</dt>
                      <dd>
                        {Number(m.value).toLocaleString("id-ID")} {m.unit}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </section>
        </div>
      </ProductSelectionProvider>
      {p.images.some((i) => i.defect) && (
        <section className="section-space">
          <h2>Foto detail kondisi</h2>
          <div className="defect-images">
            {p.images
              .filter((i) => i.defect)
              .map((i) => (
                <figure key={i.url}>
                  <ProductPhoto image={i} />
                  <figcaption>{i.alt}</figcaption>
                </figure>
              ))}
          </div>
        </section>
      )}
      <ProductReviews reviews={reviews} summary={summary} page={page} />
      {related.length > 0 && (
        <section className="section-space">
          <div className="section-heading">
            <h2>Dalam kategori yang sama</h2>
            <Link className="text-link" href={`/category/${p.categorySlug}`}>
              Lihat kategori
            </Link>
          </div>
          <ProductGrid products={related} />
        </section>
      )}
    </main>
  );
}
