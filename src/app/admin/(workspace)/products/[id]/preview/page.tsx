import Link from "next/link";
import { notFound } from "next/navigation";
import { adminProduct } from "@/server/services/admin-products";
import { AppError } from "@/lib/errors";
import { formatIdr } from "@/lib/domain/money";
import { Gallery } from "@/features/storefront/Interactions";
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let p;
  try {
    p = await adminProduct((await params).id);
  } catch (error) {
    if (
      error instanceof AppError &&
      ["NOT_FOUND", "VALIDATION_ERROR"].includes(error.code)
    )
      notFound();
    throw error;
  }
  return (
    <main id="main-content">
      <div className="section-heading">
        <h1>Preview produk</h1>
        <Link className="text-link" href={`/admin/products/${p.id}/edit`}>
          Kembali ke editor
        </Link>
      </div>
      <p className="small-note">
        Preview terautentikasi · {p.status} · hanya data tersimpan. Halaman ini
        tidak diindeks.
      </p>
      <div className="product-detail">
        <Gallery
          images={p.images.flatMap((i) => (i.image ? [i.image] : []))}
          name={p.name}
        />
        <section className="admin-preview-copy">
          <h2>{p.name}</h2>
          <p className="detail-price">{formatIdr(p.price)}</p>
          <p>Ukuran: {p.sizeLabel || "Belum diisi"}</p>
          <h3>Deskripsi</h3>
          <p className="prose-copy">{p.description}</p>
          <h3>Kondisi</h3>
          <p>{p.conditionGrade}</p>
          <p className="prose-copy">{p.conditionNotes}</p>
          {p.defectNotes && (
            <>
              <h3>Catatan cacat</h3>
              <p className="prose-copy">{p.defectNotes}</p>
            </>
          )}
          <h3>Pengukuran</h3>
          <dl className="measurements">
            {p.measurements.map((m) => (
              <div key={m.key}>
                <dt>{m.label}</dt>
                <dd>
                  {m.value} {m.unit}
                </dd>
              </div>
            ))}
          </dl>
          <h3>SEO tersimpan</h3>
          <p>{p.seoTitle || p.name}</p>
          <p>
            {p.seoDescription ||
              p.shortDescription ||
              p.description.slice(0, 160)}
          </p>
          {p.status === "active" && (
            <Link className="text-link" href={`/products/${p.slug}`}>
              Buka di storefront
            </Link>
          )}
        </section>
      </div>
    </main>
  );
}
