"use client";

import { useId, useState } from "react";
import Link from "next/link";

export type ReviewItem = {
  id: string;
  reviewerName: string;
  rating: number;
  body: string;
  createdAt: string | Date;
  verifiedPurchase: boolean;
};

export type ReviewSummaryData = {
  count: number;
  average: number | null;
};

export function StarIcon({
  filled = true,
  size = 16,
  className = "",
}: {
  filled?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "#f59e0b" : "none"}
      stroke={filled ? "#f59e0b" : "var(--border, #d4d5cc)"}
      strokeWidth={filled ? "0.5" : "1.5"}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function StarRatingRow({
  rating = 5,
  max = 5,
  size = 16,
}: {
  rating?: number;
  max?: number;
  size?: number;
}) {
  const rounded = Math.round(rating);
  return (
    <div
      className="review-stars-row"
      aria-label={`Rating ${rating} dari ${max} bintang`}
    >
      {Array.from({ length: max }).map((_, i) => (
        <StarIcon key={i} filled={i < rounded} size={size} />
      ))}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "U";
}

const AVATAR_PALETTES = [
  { bg: "#e9f2eb", text: "#24482b" },
  { bg: "#f7efe6", text: "#684318" },
  { bg: "#edeef7", text: "#313868" },
  { bg: "#f5eaf2", text: "#652d52" },
  { bg: "#f5f3e9", text: "#5c521f" },
];

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_PALETTES.length;
  }
  return AVATAR_PALETTES[hash]!;
}

export function ProductReviews({
  reviews,
  summary,
  page,
}: {
  reviews: ReviewItem[];
  summary: ReviewSummaryData;
  page: number;
}) {
  const [selectedFilter, setSelectedFilter] = useState<number | "all">("all");
  const headingId = useId();

  // Distribution calculation
  const totalCount = summary.count;
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const starCount = reviews.filter((r) => r.rating === star).length;
    const percentage = totalCount > 0 ? (starCount / totalCount) * 100 : 0;
    return { star, count: starCount, percentage };
  });

  const filteredReviews =
    selectedFilter === "all"
      ? reviews
      : reviews.filter((r) => r.rating === selectedFilter);

  return (
    <section
      className="pdp-reviews-root"
      id="reviews"
      aria-labelledby={headingId}
    >
      <div className="pdp-reviews-header">
        <div>
          <span className="pdp-reviews-eyebrow">Ulasan & Kepuasan</span>
          <h2 id={headingId} className="pdp-reviews-title">
            Ulasan Pelanggan
          </h2>
        </div>
        {totalCount > 0 && (
          <span className="pdp-reviews-count-badge">
            {totalCount} Ulasan Terverifikasi
          </span>
        )}
      </div>

      {totalCount === 0 ? (
        <div className="pdp-reviews-empty">
          <div className="pdp-reviews-empty-icon">
            <StarIcon filled={false} size={36} />
          </div>
          <h3>Belum ada ulasan untuk produk ini</h3>
          <p>
            Ulasan akan muncul setelah pelanggan yang membeli memberikan
            testimoni mereka.
          </p>
        </div>
      ) : (
        <div className="pdp-reviews-grid">
          {/* SISI KIRI: Summary Scorecard */}
          <aside
            className="pdp-reviews-scorecard"
            aria-label="Ringkasan Rating"
          >
            <div className="pdp-score-main">
              <span className="pdp-score-number">
                {summary.average ? summary.average.toFixed(1) : "5.0"}
              </span>
              <div className="pdp-score-meta">
                <StarRatingRow rating={summary.average ?? 5} size={20} />
                <span className="pdp-score-total">
                  Berdasarkan {totalCount} ulasan
                </span>
              </div>
            </div>

            <div className="pdp-score-breakdown">
              {distribution.map((d) => (
                <button
                  type="button"
                  key={d.star}
                  onClick={() =>
                    setSelectedFilter(
                      selectedFilter === d.star ? "all" : d.star,
                    )
                  }
                  className={`pdp-breakdown-row ${selectedFilter === d.star ? "active" : ""}`}
                  title={`Filter bintang ${d.star}`}
                >
                  <span className="pdp-breakdown-label">
                    {d.star} <StarIcon filled size={12} />
                  </span>
                  <div className="pdp-breakdown-bar">
                    <div
                      className="pdp-breakdown-fill"
                      style={{ width: `${d.percentage}%` }}
                    />
                  </div>
                  <span className="pdp-breakdown-count">{d.count}</span>
                </button>
              ))}
            </div>

            <div className="pdp-reviews-trust-pill">
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
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>100% Ulasan dari pembeli asli</span>
            </div>
          </aside>

          {/* SISI KANAN: Daftar Ulasan */}
          <div className="pdp-reviews-stream">
            <div className="pdp-reviews-filter-bar">
              <span className="pdp-filter-caption">
                Menampilkan {filteredReviews.length} ulasan
                {selectedFilter !== "all" && ` (Bintang ${selectedFilter})`}
              </span>
              <div className="pdp-filter-chips">
                <button
                  type="button"
                  className={`pdp-chip ${selectedFilter === "all" ? "active" : ""}`}
                  onClick={() => setSelectedFilter("all")}
                >
                  Semua ({totalCount})
                </button>
                {distribution
                  .filter((d) => d.count > 0)
                  .map((d) => (
                    <button
                      type="button"
                      key={d.star}
                      className={`pdp-chip ${selectedFilter === d.star ? "active" : ""}`}
                      onClick={() => setSelectedFilter(d.star)}
                    >
                      ★ {d.star} ({d.count})
                    </button>
                  ))}
              </div>
            </div>

            <div className="pdp-reviews-list">
              {filteredReviews.map((r) => {
                const avatar = getAvatarStyle(r.reviewerName);
                const dateObj = new Date(r.createdAt);
                const formattedDate = dateObj.toLocaleDateString("id-ID", {
                  timeZone: "Asia/Jakarta",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });

                return (
                  <article className="pdp-review-card" key={r.id}>
                    <div className="pdp-review-top">
                      <div className="pdp-review-user">
                        <div
                          className="pdp-reviewer-avatar"
                          style={{
                            backgroundColor: avatar.bg,
                            color: avatar.text,
                          }}
                          aria-hidden="true"
                        >
                          {getInitials(r.reviewerName)}
                        </div>
                        <div className="pdp-reviewer-details">
                          <div className="pdp-reviewer-name-row">
                            <span className="pdp-reviewer-name">
                              {r.reviewerName}
                            </span>
                            <span className="pdp-verified-badge">
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                              </svg>
                              Pembeli Terverifikasi
                            </span>
                          </div>
                          <div className="pdp-review-meta">
                            <StarRatingRow rating={r.rating} size={14} />
                            <span className="pdp-meta-divider">•</span>
                            <time dateTime={dateObj.toISOString()}>
                              {formattedDate}
                            </time>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="pdp-review-body">{r.body}</p>

                    <div className="pdp-review-footer">
                      <span className="pdp-satisfaction-tag">
                        ✓ Sesuai deskripsi
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            {totalCount > 20 && (
              <nav className="pdp-pagination" aria-label="Halaman ulasan">
                {page > 1 && (
                  <Link
                    href={`?reviews=${page - 1}#reviews`}
                    className="pdp-page-button"
                  >
                    ← Sebelumnya
                  </Link>
                )}
                <span className="pdp-page-indicator">Halaman {page}</span>
                {page * 20 < totalCount && (
                  <Link
                    href={`?reviews=${page + 1}#reviews`}
                    className="pdp-page-button"
                  >
                    Selanjutnya →
                  </Link>
                )}
              </nav>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
