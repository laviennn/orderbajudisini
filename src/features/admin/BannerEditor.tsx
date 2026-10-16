"use client";

import Image from "next/image";
import { useState } from "react";
import { adminRequest, errorText } from "./http";
import { SiteImageInput } from "./SiteImageInput";
import { AdminModal } from "./AdminModal";

type Banner = {
  id?: string;
  internalName: string;
  headline: string | null;
  body: string | null;
  imageObjectKey: string | null;
  mobileImageObjectKey: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  active: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  imageUrl?: string | null;
  mobileUrl?: string | null;
};

const emptyBanner: Banner = {
  internalName: "",
  headline: null,
  body: null,
  imageObjectKey: null,
  mobileImageObjectKey: null,
  ctaLabel: null,
  ctaUrl: null,
  active: true,
  sortOrder: 0,
  startsAt: null,
  endsAt: null,
};

const LINK_PRESETS = [
  { label: "Semua Produk", url: "/products", cta: "Belanja Sekarang" },
  {
    label: "Koleksi Gamis",
    url: "/products?category=gamis",
    cta: "Lihat Gamis",
  },
  {
    label: "Koleksi Tunik",
    url: "/products?category=tunik",
    cta: "Lihat Tunik",
  },
  {
    label: "Koleksi Dress",
    url: "/products?category=dress",
    cta: "Lihat Dress",
  },
];

export function BannerEditor({
  initial,
  editable,
}: {
  initial: Banner[];
  editable: boolean;
}) {
  const [rows, setRows] = useState<Banner[]>(initial);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [value, setValue] = useState<Banner>(emptyBanner);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const [hasSchedule, setHasSchedule] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [bannerToDelete, setBannerToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  async function refresh() {
    try {
      const updated = await adminRequest<Banner[]>("/api/admin/banners");
      setRows(updated);
    } catch {
      // Silent refresh fallback
    }
  }

  function openCreateModal() {
    setValue(emptyBanner);
    setHasSchedule(false);
    setPreviewDevice("desktop");
    setIsModalOpen(true);
  }

  function openEditModal(row: Banner) {
    setValue(row);
    setHasSchedule(Boolean(row.startsAt || row.endsAt));
    setPreviewDevice("desktop");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (busy || uploading) return;
    setIsModalOpen(false);
    setValue(emptyBanner);
  }

  // Quick 1-click active/inactive toggle directly in table row
  async function handleQuickToggle(row: Banner) {
    if (!row.id || !editable || busy || togglingId) return;

    const nextActive = !row.active;
    if (nextActive && !row.headline && !row.imageObjectKey) {
      setMessage({
        text: `Banner "${row.internalName}" memerlukan minimal gambar desktop atau judul sebelum diaktifkan.`,
        type: "error",
      });
      return;
    }

    setTogglingId(row.id);

    // Optimistic UI update
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, active: nextActive } : r)),
    );

    try {
      const {
        imageUrl: _img,
        mobileUrl: _mob,
        ...data
      } = {
        ...row,
        active: nextActive,
      };
      void _img;
      void _mob;

      await adminRequest("/api/admin/banners", { action: "save", data });
      await refresh();
      setMessage({
        text: `Status banner "${row.internalName}" berhasil diubah menjadi ${nextActive ? "Aktif" : "Nonaktif"}.`,
        type: "success",
      });
    } catch (error) {
      // Revert optimistic update
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, active: row.active } : r)),
      );
      setMessage({ text: errorText(error), type: "error" });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSaveBanner(e: React.FormEvent) {
    e.preventDefault();

    // Client-side validations
    if (!value.internalName.trim()) {
      setMessage({ text: "Nama internal banner wajib diisi.", type: "error" });
      return;
    }

    if (value.active && !value.headline && !value.imageObjectKey) {
      setMessage({
        text: "Banner yang aktif wajib memiliki gambar desktop atau judul.",
        type: "error",
      });
      return;
    }

    if (Boolean(value.ctaLabel) !== Boolean(value.ctaUrl)) {
      setMessage({
        text: "Label tombol dan URL tujuan harus diisi bersamaan (atau kosongkan keduanya).",
        type: "error",
      });
      return;
    }

    if (value.ctaUrl && !value.ctaUrl.startsWith("/")) {
      setMessage({
        text: "Tautan tujuan harus diawali dengan slash (/), contoh: /products",
        type: "error",
      });
      return;
    }

    if (hasSchedule && value.startsAt && value.endsAt) {
      if (
        new Date(value.startsAt).getTime() >= new Date(value.endsAt).getTime()
      ) {
        setMessage({
          text: "Waktu selesai penayangan harus lebih akhir dari waktu mulai.",
          type: "error",
        });
        return;
      }
    }

    setBusy(true);
    try {
      const payload: Banner = {
        ...value,
        startsAt: hasSchedule ? value.startsAt : null,
        endsAt: hasSchedule ? value.endsAt : null,
      };

      const { imageUrl: _image, mobileUrl: _mobile, ...data } = payload;
      void _image;
      void _mobile;

      await adminRequest("/api/admin/banners", { action: "save", data });
      await refresh();
      setIsModalOpen(false);
      setValue(emptyBanner);
      setMessage({
        text: `Banner "${payload.internalName}" berhasil disimpan.`,
        type: "success",
      });
    } catch (error) {
      setMessage({ text: errorText(error), type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteBanner() {
    if (!bannerToDelete) return;
    setBusy(true);
    try {
      await adminRequest("/api/admin/banners", {
        action: "delete",
        data: { id: bannerToDelete.id },
      });
      await refresh();
      if (value.id === bannerToDelete.id) setValue(emptyBanner);
      setMessage({
        text: `Banner "${bannerToDelete.name}" berhasil dihapus.`,
        type: "success",
      });
      setBannerToDelete(null);
    } catch (error) {
      setMessage({ text: errorText(error), type: "error" });
    } finally {
      setBusy(false);
    }
  }

  const toLocalInputValue = (v: string | null) => {
    if (!v) return "";
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return "";
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    } catch {
      return "";
    }
  };

  const formatDateShort = (iso: string | null) => {
    if (!iso) return "-";
    try {
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  function getBannerStatus(row: Banner) {
    const now = new Date().getTime();
    if (!row.active) {
      return {
        status: "inactive",
        label: "Nonaktif",
        badgeClass: "banner-status-badge inactive",
        desc: "Tidak tampil di toko",
      };
    }
    const start = row.startsAt ? new Date(row.startsAt).getTime() : null;
    const end = row.endsAt ? new Date(row.endsAt).getTime() : null;

    if (start && start > now) {
      return {
        status: "scheduled",
        label: "Terjadwal",
        badgeClass: "banner-status-badge scheduled",
        desc: `Mulai ${formatDateShort(row.startsAt)}`,
      };
    }
    if (end && end <= now) {
      return {
        status: "expired",
        label: "Kedaluwarsa",
        badgeClass: "banner-status-badge expired",
        desc: `Berakhir ${formatDateShort(row.endsAt)}`,
      };
    }
    return {
      status: "live",
      label: "Tayang Sekarang",
      badgeClass: "banner-status-badge live",
      desc: end
        ? `Sampai ${formatDateShort(row.endsAt)}`
        : "Aktif terus menerus",
    };
  }

  // Calculate metrics
  const totalBanners = rows.length;
  const liveCount = rows.filter(
    (r) => getBannerStatus(r).status === "live",
  ).length;
  const scheduledCount = rows.filter(
    (r) => getBannerStatus(r).status === "scheduled",
  ).length;
  const inactiveCount = rows.filter(
    (r) => !r.active || getBannerStatus(r).status === "expired",
  ).length;

  return (
    <div className="banner-admin-wrapper">
      {/* Header & Primary Action Bar */}
      <div className="banner-top-bar">
        <div className="banner-page-title-group">
          <h1>Banner Beranda</h1>
          <p>
            Kelola gambar promosi dan visual utama etalase toko yang tampil di
            halaman depan.
          </p>
        </div>
        {editable && (
          <button
            type="button"
            className="banner-create-btn"
            disabled={busy || uploading}
            onClick={openCreateModal}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            + Tambah Banner Baru
          </button>
        )}
      </div>

      {/* KPI / Metric Chips Bar */}
      <div className="banner-stats-grid">
        <div className="banner-stat-card">
          <span className="banner-stat-label">Total Banner</span>
          <span className="banner-stat-value">{totalBanners}</span>
        </div>
        <div className="banner-stat-card">
          <span className="banner-stat-label" style={{ color: "#059669" }}>
            Sedang Tayang
          </span>
          <span className="banner-stat-value" style={{ color: "#059669" }}>
            {liveCount}
          </span>
        </div>
        <div className="banner-stat-card">
          <span className="banner-stat-label" style={{ color: "#d97706" }}>
            Terjadwal
          </span>
          <span className="banner-stat-value" style={{ color: "#d97706" }}>
            {scheduledCount}
          </span>
        </div>
        <div className="banner-stat-card">
          <span className="banner-stat-label" style={{ color: "#6b7280" }}>
            Nonaktif / Lewat
          </span>
          <span className="banner-stat-value" style={{ color: "#4b5563" }}>
            {inactiveCount}
          </span>
        </div>
      </div>

      {/* Inline Feedback Alert */}
      {message && (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: message.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: message.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${message.type === "success" ? "#a7f3d0" : "#fecaca"}`,
          }}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Table or Empty State */}
      {rows.length === 0 ? (
        <div className="banner-empty-card">
          <div className="banner-empty-icon">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <h3 className="banner-empty-title">Belum Ada Banner Beranda</h3>
          <p className="banner-empty-desc">
            Saat ini beranda toko tidak menampilkan banner hero. Tambahkan
            banner untuk mempromosikan koleksi terbaru, diskon musiman, atau
            katalog busana favorit.
          </p>
          {editable && (
            <button
              type="button"
              className="banner-create-btn"
              onClick={openCreateModal}
            >
              + Buat Banner Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="banner-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "120px" }}>Visual</th>
                  <th>Nama &amp; Target</th>
                  <th style={{ width: "160px" }}>Jadwal &amp; Status</th>
                  <th style={{ width: "110px", textAlign: "center" }}>
                    Tayangkan
                  </th>
                  <th style={{ width: "130px", textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const statusInfo = getBannerStatus(row);
                  const isToggling = togglingId === row.id;

                  return (
                    <tr key={row.id}>
                      {/* Visual Thumbnail */}
                      <td>
                        <div className="banner-table-thumb-wrap">
                          {row.imageUrl ? (
                            <Image
                              unoptimized
                              src={row.imageUrl}
                              alt={row.internalName}
                              width={104}
                              height={56}
                              className="banner-thumb-img"
                            />
                          ) : (
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                color: "var(--muted-foreground)",
                                textAlign: "center",
                                padding: "0.25rem",
                              }}
                            >
                              Teks Saja
                            </span>
                          )}
                          {row.mobileUrl && (
                            <span
                              className="banner-mobile-indicator"
                              title="Tersedia gambar khusus mobile"
                            >
                              📱
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Name & Target Details */}
                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              color: "var(--foreground)",
                              fontSize: "0.9375rem",
                            }}
                          >
                            {row.internalName}
                          </span>
                          {row.headline && (
                            <span
                              style={{
                                fontSize: "0.8125rem",
                                color: "var(--muted-foreground)",
                              }}
                            >
                              &quot;{row.headline}&quot;
                            </span>
                          )}
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.5rem",
                              marginTop: "0.125rem",
                            }}
                          >
                            {row.ctaUrl ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                  fontSize: "0.75rem",
                                  color: "var(--primary)",
                                  background: "var(--surface-subtle)",
                                  padding: "0.125rem 0.4rem",
                                  borderRadius: "4px",
                                }}
                              >
                                🔗 {row.ctaUrl}
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--muted-foreground)",
                                }}
                              >
                                Tanpa tautan
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                color: "var(--muted-foreground)",
                                background: "var(--surface-subtle)",
                                padding: "0.125rem 0.35rem",
                                borderRadius: "4px",
                              }}
                            >
                              Urutan #{row.sortOrder}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status & Schedule */}
                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.375rem",
                          }}
                        >
                          <span className={statusInfo.badgeClass}>
                            <span className="status-dot" />
                            {statusInfo.label}
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--muted-foreground)",
                              lineHeight: 1.3,
                            }}
                          >
                            {statusInfo.desc}
                          </span>
                        </div>
                      </td>

                      {/* Quick 1-Click Toggle Switch */}
                      <td style={{ textAlign: "center" }}>
                        <label
                          className="admin-switch-label"
                          title={
                            row.active
                              ? "Klik untuk menonaktifkan"
                              : "Klik untuk mengaktifkan"
                          }
                        >
                          <input
                            type="checkbox"
                            className="admin-switch-input"
                            checked={row.active}
                            disabled={!editable || busy || isToggling}
                            onChange={() => handleQuickToggle(row)}
                          />
                          <span className="admin-switch-track">
                            <span className="admin-switch-thumb" />
                          </span>
                        </label>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.625rem",
                          }}
                        >
                          <button
                            type="button"
                            className="text-link"
                            disabled={busy || uploading}
                            onClick={() => openEditModal(row)}
                            style={{ fontSize: "0.8125rem", fontWeight: 500 }}
                          >
                            Edit
                          </button>
                          {editable && (
                            <button
                              type="button"
                              className="text-link"
                              disabled={busy || uploading}
                              onClick={() =>
                                setBannerToDelete({
                                  id: row.id!,
                                  name: row.internalName,
                                })
                              }
                              style={{
                                color: "var(--danger)",
                                fontSize: "0.8125rem",
                              }}
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revamped Editor Modal */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={closeModal}
        maxWidth="820px"
        title={
          value.id ? `Edit Banner: ${value.internalName}` : "Tambah Banner Baru"
        }
        subtitle="Atur gambar, tautan tujuan, dan periode tayang banner di etalase toko."
        variant="info"
        footer={
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              width: "100%",
            }}
          >
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-cancel"
              disabled={busy || uploading}
              onClick={closeModal}
            >
              Batal
            </button>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-primary"
              disabled={!editable || busy || uploading}
              onClick={(e) => handleSaveBanner(e as unknown as React.FormEvent)}
            >
              {busy
                ? "Menyimpan…"
                : value.id
                  ? "Simpan Perubahan"
                  : "Buat Banner"}
            </button>
          </div>
        }
      >
        <form
          onSubmit={handleSaveBanner}
          style={{ display: "flex", flexDirection: "column" }}
        >
          {/* Real-time Interactive Storefront Preview Card */}
          <div className="banner-preview-container">
            <div className="banner-preview-toolbar">
              <span className="banner-preview-title">
                Simulasi Etalase Toko (Live Preview)
              </span>
              <div className="banner-preview-device-toggle">
                <button
                  type="button"
                  className={`banner-preview-device-btn ${previewDevice === "desktop" ? "active" : ""}`}
                  onClick={() => setPreviewDevice("desktop")}
                >
                  🖥️ Desktop
                </button>
                <button
                  type="button"
                  className={`banner-preview-device-btn ${previewDevice === "mobile" ? "active" : ""}`}
                  onClick={() => setPreviewDevice("mobile")}
                >
                  📱 Mobile
                </button>
              </div>
            </div>

            <div
              className={`banner-preview-screen ${previewDevice === "mobile" ? "device-mobile" : ""}`}
            >
              <div className="banner-preview-stage">
                {(() => {
                  const currentImage =
                    previewDevice === "mobile"
                      ? value.mobileUrl || value.imageUrl
                      : value.imageUrl;

                  if (currentImage) {
                    return (
                      <Image
                        unoptimized
                        src={currentImage}
                        alt="Preview banner"
                        width={previewDevice === "mobile" ? 400 : 800}
                        height={previewDevice === "mobile" ? 500 : 413}
                        style={{
                          objectFit: "cover",
                          width: "100%",
                          height: "100%",
                        }}
                      />
                    );
                  }

                  return (
                    <div
                      style={{
                        textAlign: "center",
                        color: "#64748b",
                        padding: "1.5rem",
                      }}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ margin: "0 auto 0.5rem" }}
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <p style={{ margin: 0, fontSize: "0.8125rem" }}>
                        Unggah gambar desktop untuk melihat pratinjau di etalase
                      </p>
                    </div>
                  );
                })()}

                {(value.headline || value.ctaLabel) && (
                  <div className="banner-preview-overlay-content">
                    {value.headline && (
                      <h4 className="banner-preview-headline">
                        {value.headline}
                      </h4>
                    )}
                    {value.ctaLabel && (
                      <span className="banner-preview-cta">
                        {value.ctaLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Instagram Bar Simulation */}
              <div
                style={{
                  background: "#0c0f0d",
                  padding: "0.4rem 0.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.6875rem",
                  color: "#9ca3af",
                  borderTop: "1px solid #273329",
                }}
              >
                <span>📷 Ikuti Instagram Kami</span>
                <span style={{ color: "#34d399", fontWeight: 500 }}>
                  @orderbajudisini
                </span>
              </div>
            </div>
          </div>

          <fieldset
            disabled={!editable || busy || uploading}
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            {/* Section 1: Visual & Media */}
            <div className="banner-form-section">
              <h4 className="banner-section-title">
                🖼️ 1. Gambar &amp; Media Banner
              </h4>
              <div className="banner-form-grid-2">
                <SiteImageInput
                  label="Gambar Desktop (Wajib / Utama)"
                  aspectHint="Disarankan 1200 × 620 px (16:9)"
                  value={value.imageObjectKey}
                  url={value.imageUrl}
                  scope="banner"
                  onBusy={setUploading}
                  onChange={(key, url) =>
                    setValue((v) => ({
                      ...v,
                      imageObjectKey: key,
                      imageUrl: url,
                    }))
                  }
                />
                <SiteImageInput
                  label="Gambar Mobile (Opsional)"
                  aspectHint="Disarankan 800 × 1000 px (4:5)"
                  value={value.mobileImageObjectKey}
                  url={value.mobileUrl}
                  scope="banner"
                  onBusy={setUploading}
                  onChange={(key, url) =>
                    setValue((v) => ({
                      ...v,
                      mobileImageObjectKey: key,
                      mobileUrl: url,
                    }))
                  }
                />
              </div>
            </div>

            {/* Section 2: Identitas & Konten Teks */}
            <div className="banner-form-section">
              <h4 className="banner-section-title">
                📝 2. Identitas &amp; Teks Promosi
              </h4>
              <label>
                Nama Internal Banner (Wajib)
                <input
                  required
                  placeholder="Contoh: Promo Lebaran 2026 / Flash Sale Weekend"
                  value={value.internalName}
                  onChange={(e) =>
                    setValue({ ...value, internalName: e.target.value })
                  }
                />
                <span className="banner-helper-note">
                  Hanya terlihat oleh admin toko untuk keperluan identifikasi.
                </span>
              </label>

              <div className="banner-form-grid-2">
                <label>
                  Judul Teks Banner (Opsional)
                  <input
                    placeholder="Contoh: Koleksi Pilihan Thrift Premium"
                    value={value.headline ?? ""}
                    onChange={(e) =>
                      setValue({ ...value, headline: e.target.value || null })
                    }
                  />
                </label>
                <label>
                  Teks Deskripsi / Subtitle (Opsional)
                  <input
                    placeholder="Contoh: Diskon hingga 40% untuk item pilihan"
                    value={value.body ?? ""}
                    onChange={(e) =>
                      setValue({ ...value, body: e.target.value || null })
                    }
                  />
                </label>
              </div>
            </div>

            {/* Section 3: Tautan & Tombol Aksi (CTA) */}
            <div className="banner-form-section">
              <h4 className="banner-section-title">
                🔗 3. Tautan Tujuan Banner (Call To Action)
              </h4>
              <div className="banner-form-grid-2">
                <label>
                  Tujuan Tautan (URL)
                  <input
                    placeholder="/products"
                    value={value.ctaUrl ?? ""}
                    onChange={(e) => {
                      const nextUrl = e.target.value || null;
                      setValue((v) => ({
                        ...v,
                        ctaUrl: nextUrl,
                        // If ctaUrl is added and ctaLabel is empty, provide default helper
                        ctaLabel:
                          nextUrl && !v.ctaLabel
                            ? "Belanja Sekarang"
                            : v.ctaLabel,
                      }));
                    }}
                  />
                </label>

                <label>
                  Label Tombol Tautan
                  <input
                    placeholder="Contoh: Belanja Sekarang / Lihat Koleksi"
                    value={value.ctaLabel ?? ""}
                    onChange={(e) =>
                      setValue({ ...value, ctaLabel: e.target.value || null })
                    }
                  />
                </label>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--muted-foreground)",
                  }}
                >
                  Pilihan Tautan Cepat:
                </span>
                <div className="banner-preset-row">
                  {LINK_PRESETS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      className="banner-preset-btn"
                      onClick={() =>
                        setValue((v) => ({
                          ...v,
                          ctaUrl: preset.url,
                          ctaLabel: v.ctaLabel || preset.cta,
                        }))
                      }
                    >
                      + {preset.label} ({preset.url})
                    </button>
                  ))}
                  {value.ctaUrl && (
                    <button
                      type="button"
                      className="banner-preset-btn"
                      style={{ color: "var(--danger)" }}
                      onClick={() =>
                        setValue((v) => ({
                          ...v,
                          ctaUrl: null,
                          ctaLabel: null,
                        }))
                      }
                    >
                      ✕ Hapus Tautan
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Pengaturan & Jadwal Tayang */}
            <div className="banner-form-section">
              <h4 className="banner-section-title">
                ⏱️ 4. Pengaturan &amp; Jadwal Penayangan
              </h4>

              <div
                className="banner-form-grid-2"
                style={{ alignItems: "center" }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <label className="admin-switch-label">
                    <input
                      type="checkbox"
                      className="admin-switch-input"
                      checked={value.active}
                      onChange={(e) =>
                        setValue({ ...value, active: e.target.checked })
                      }
                    />
                    <span className="admin-switch-track">
                      <span className="admin-switch-thumb" />
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      {value.active ? "Banner Aktif" : "Banner Nonaktif"}
                    </span>
                  </label>
                  <span className="banner-helper-note">
                    Jika aktif, banner akan tampil di beranda toko sesuai urutan
                    prioritas.
                  </span>
                </div>

                <label>
                  Urutan Prioritas Tampil (Angka terkecil tayang duluan)
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={value.sortOrder}
                    onChange={(e) =>
                      setValue({
                        ...value,
                        sortOrder: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
              </div>

              {/* Schedule Toggle */}
              <div
                style={{
                  borderTop: "1px dashed var(--border)",
                  paddingTop: "0.875rem",
                  marginTop: "0.25rem",
                }}
              >
                <label
                  className="checkbox-label"
                  style={{ fontWeight: 600, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={hasSchedule}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setHasSchedule(enabled);
                      if (!enabled) {
                        setValue((v) => ({
                          ...v,
                          startsAt: null,
                          endsAt: null,
                        }));
                      } else {
                        // Pre-populate with now until 7 days
                        const now = new Date();
                        const nextWeek = new Date(
                          now.getTime() + 7 * 24 * 60 * 60 * 1000,
                        );
                        setValue((v) => ({
                          ...v,
                          startsAt: v.startsAt || now.toISOString(),
                          endsAt: v.endsAt || nextWeek.toISOString(),
                        }));
                      }
                    }}
                  />
                  Atur Jadwal Waktu Tayang Tertentu (Opsional)
                </label>

                {hasSchedule && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <div className="banner-form-grid-2">
                      <label>
                        Mulai Tayang (Waktu lokal)
                        <input
                          type="datetime-local"
                          value={toLocalInputValue(value.startsAt)}
                          onChange={(e) =>
                            setValue({
                              ...value,
                              startsAt: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null,
                            })
                          }
                        />
                      </label>
                      <label>
                        Selesai Tayang (Waktu lokal)
                        <input
                          type="datetime-local"
                          value={toLocalInputValue(value.endsAt)}
                          onChange={(e) =>
                            setValue({
                              ...value,
                              endsAt: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null,
                            })
                          }
                        />
                      </label>
                    </div>

                    {/* Quick schedule shortcuts */}
                    <div className="banner-preset-row">
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--muted-foreground)",
                        }}
                      >
                        Shortcut durasi:
                      </span>
                      <button
                        type="button"
                        className="banner-preset-btn"
                        onClick={() => {
                          const now = new Date();
                          const in7Days = new Date(
                            now.getTime() + 7 * 24 * 60 * 60 * 1000,
                          );
                          setValue((v) => ({
                            ...v,
                            startsAt: now.toISOString(),
                            endsAt: in7Days.toISOString(),
                          }));
                        }}
                      >
                        + 7 Hari
                      </button>
                      <button
                        type="button"
                        className="banner-preset-btn"
                        onClick={() => {
                          const now = new Date();
                          const in30Days = new Date(
                            now.getTime() + 30 * 24 * 60 * 60 * 1000,
                          );
                          setValue((v) => ({
                            ...v,
                            startsAt: now.toISOString(),
                            endsAt: in30Days.toISOString(),
                          }));
                        }}
                      >
                        + 30 Hari
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </fieldset>
        </form>
      </AdminModal>

      {/* Delete Confirmation Modal */}
      <AdminModal
        isOpen={Boolean(bannerToDelete)}
        onClose={() => !busy && setBannerToDelete(null)}
        title="Hapus Banner?"
        subtitle="Konfirmasi penghapusan banner dari etalase toko"
        variant="danger"
        footer={
          <>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-cancel"
              disabled={busy}
              onClick={() => setBannerToDelete(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-danger"
              disabled={busy}
              onClick={handleDeleteBanner}
            >
              {busy ? "Menghapus..." : "Ya, Hapus Banner"}
            </button>
          </>
        }
      >
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Apakah Anda yakin ingin menghapus banner{" "}
          <strong>&quot;{bannerToDelete?.name}&quot;</strong>? Tindakan ini
          tidak dapat dibatalkan dan banner akan langsung dihapus dari etalase
          toko.
        </p>
      </AdminModal>
    </div>
  );
}
