import { listAdminReviews } from "@/server/services/reviews";
import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import { ReviewActions } from "@/features/admin/ReviewActions";
import { AdminPagination } from "@/features/admin/Pagination";
import { dateTime } from "@/lib/admin-operations";
const labels = {
  pending: "Menunggu moderasi",
  approved: "Disetujui",
  rejected: "Ditolak",
};
export default async function Reviews({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const actor = await requirePermission("reviews.read"),
    data = await listAdminReviews(await searchParams);
  return (
    <main id="main-content">
      <h1>Moderasi ulasan</h1>
      <p>Hanya ulasan yang disetujui tampil di toko.</p>
      <form className="admin-filters" action="/admin/reviews">
        <label>
          Cari pengulas / produk / SKU
          <input name="q" maxLength={80} defaultValue={data.q} />
        </label>
        <label>
          Status ulasan
          <select name="status" defaultValue={data.status}>
            <option value="">Semua status</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-action">Terapkan</button>
      </form>
      <ul className="admin-review-list">
        {data.items.map((review) => (
          <li key={review.id}>
            <h2>{review.productName}</h2>
            <p className="small-note">
              SKU {review.productSku} · {review.reviewerName} ·{" "}
              {dateTime(review.createdAt)}
            </p>
            <p>
              Nilai {review.rating}/5 · {labels[review.status]}
            </p>
            <p className="review-body">{review.body}</p>
            {review.moderatedAt && (
              <p className="small-note">
                Dimoderasi {dateTime(review.moderatedAt)} oleh{" "}
                {review.moderator ?? "Staf"}.
              </p>
            )}
            {hasPermission(actor, "reviews.moderate") && (
              <ReviewActions
                id={review.id}
                status={review.status}
                updatedAt={review.updatedAt.toISOString()}
              />
            )}
          </li>
        ))}
      </ul>
      {!data.items.length && (
        <p className="empty-state">Tidak ada ulasan yang sesuai.</p>
      )}
      <AdminPagination
        path="/admin/reviews"
        {...data}
        filters={{ q: data.q, status: data.status }}
      />
    </main>
  );
}
