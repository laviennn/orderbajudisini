import Link from "next/link";
import { notFound } from "next/navigation";
import {
  readProduct,
  readRelated,
  readReviews,
  readReviewSummary,
  storeForShell,
} from "@/server/services/storefront";
import { absoluteUrl, jsonLd, pageMetadata, seoTitle } from "@/lib/seo";
import { availabilityLabel } from "@/lib/catalog";
import { formatIdr } from "@/lib/domain/money";
import {
  AddToCart,
  AnalyticsView,
  Gallery,
  ProductPhoto,
} from "@/features/storefront/Interactions";
import { ProductGrid } from "@/features/storefront/Products";
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
  const [reviews, summary, related] = await Promise.all([
    readReviews(p.id, page),
    readReviewSummary(p.id),
    readRelated(p.id, p.categoryId),
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
      <div className="product-detail">
        <Gallery images={p.images} name={p.name} />
        <section className="product-info">
          <p className="eyebrow">{availabilityLabel[p.status]}</p>
          <h1>{p.name}</h1>
          <p className="detail-price">{formatIdr(p.price)}</p>
          <dl className="product-facts">
            {p.sizeLabel && (
              <div>
                <dt>Ukuran</dt>
                <dd>{p.sizeLabel}</dd>
              </div>
            )}
            {p.conditionGrade && (
              <div>
                <dt>Kondisi</dt>
                <dd>{p.conditionGrade}</dd>
              </div>
            )}
            {p.brand && (
              <div>
                <dt>Merek</dt>
                <dd>{p.brand}</dd>
              </div>
            )}
            <div>
              <dt>SKU</dt>
              <dd>{p.sku}</dd>
            </div>
          </dl>
          <AddToCart id={p.id} available={p.status === "active"} />
          <section className="product-copy">
            <h2>Tentang produk</h2>
            <p>{p.description}</p>
          </section>
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
      <section className="review-section" id="reviews">
        <div>
          <p className="eyebrow">Ulasan produk</p>
          <h2>
            {summary.count
              ? `${summary.average?.toFixed(1)} / 5`
              : "Belum ada ulasan."}
          </h2>
          {summary.count > 0 && <p>{summary.count} ulasan</p>}
        </div>
        <div>
          {reviews.map((r) => (
            <article className="review" key={r.id}>
              <div className="section-heading">
                <h3>{r.reviewerName}</h3>
                <span>{r.rating} / 5</span>
              </div>
              <p>{r.body}</p>
              <p className="small-note">
                <time dateTime={new Date(r.createdAt).toISOString()}>
                  {new Date(r.createdAt).toLocaleDateString("id-ID", {
                    timeZone: "Asia/Jakarta",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                {r.verifiedPurchase && " · Pembelian terverifikasi"}
              </p>
            </article>
          ))}
          {summary.count > 20 && (
            <nav className="pagination" aria-label="Halaman ulasan">
              {page > 1 && (
                <Link href={`?reviews=${page - 1}#reviews`}>Sebelumnya</Link>
              )}
              {page * 20 < summary.count && (
                <Link href={`?reviews=${page + 1}#reviews`}>
                  Ulasan berikutnya
                </Link>
              )}
            </nav>
          )}
        </div>
      </section>
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
