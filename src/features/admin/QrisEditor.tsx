"use client";

import { useState, useRef } from "react";
import { authorizeQrisUploadAction, saveQrisSettingsAction } from "@/app/admin/(workspace)/payment-methods/actions";

interface QrisEditorProps {
  initialSettings: {
    merchantName: string | null;
    imageObjectKey: string | null;
    instructions: string | null;
    active: boolean;
  } | null;
  initialImageUrl: string | null;
}

export function QrisEditor({ initialSettings, initialImageUrl }: QrisEditorProps) {
  const [merchantName, setMerchantName] = useState(initialSettings?.merchantName || "");
  const [instructions, setInstructions] = useState(initialSettings?.instructions || "");
  const [active, setActive] = useState(initialSettings?.active || false);
  const [imageKey, setImageKey] = useState<string | null>(initialSettings?.imageObjectKey || null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl || null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    // Validate MIME and size
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Format file tidak didukung. Gunakan JPG, PNG, atau WebP.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 10 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Instant local preview
    const localPreview = URL.createObjectURL(file);
    setImageUrl(localPreview);

    setUploading(true);
    setUploadProgress(0);

    try {
      // 1. Authorize upload
      const signed = await authorizeQrisUploadAction({
        mime: file.type,
        bytes: file.size,
      });

      // 2. Direct upload to R2
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.url);
        xhr.timeout = 120000;
        for (const [header, val] of Object.entries(signed.headers)) {
          xhr.setRequestHeader(header, val);
        }
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("Gagal mengunggah gambar ke penyimpanan."));
          }
        };
        xhr.onerror = xhr.ontimeout = () => {
          reject(new Error("Gagal mengunggah gambar ke penyimpanan R2."));
        };
        xhr.send(file);
      });

      setImageKey(signed.key);
      setSuccess("Gambar QRIS berhasil diunggah. Klik Simpan QRIS untuk menyimpan.");
    } catch (err: unknown) {
      setImageKey(initialSettings?.imageObjectKey || null);
      setImageUrl(initialImageUrl || null);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat mengunggah gambar.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = () => {
    setImageKey(null);
    setImageUrl(null);
    setActive(false);
    setError(null);
    setSuccess("Gambar QRIS telah dilepas. Simpan perubahan untuk memperbarui.");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (active && !imageKey) {
      setError("Unggah gambar QRIS terlebih dahulu sebelum mengaktifkan QRIS.");
      return;
    }

    setSaving(true);
    try {
      await saveQrisSettingsAction({
        merchantName: merchantName.trim() || null,
        imageObjectKey: imageKey,
        instructions: instructions.trim() || null,
        active,
      });
      setSuccess("Pengaturan QRIS berhasil disimpan.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan QRIS.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-editor" style={{ maxWidth: "800px" }}>
      <form onSubmit={handleSave}>
        <fieldset>
          <legend>Pengaturan QRIS Statis</legend>

          {error && (
            <p role="alert" className="admin-error" style={{ marginBottom: "1rem" }}>
              {error}
            </p>
          )}
          {success && (
            <p role="status" style={{ color: "var(--success)", marginBottom: "1rem" }}>
              {success}
            </p>
          )}

          <div className="editor-grid">
            <label>
              Nama Merchant (Opsional)
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="Contoh: Thrift Store Official"
                maxLength={200}
                disabled={saving || uploading}
              />
            </label>
          </div>

          <label style={{ display: "block", marginBottom: "1rem" }}>
            Instruksi Pembayaran QRIS
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Contoh: Buka aplikasi mobile banking atau e-wallet Anda, lalu scan QRIS di atas..."
              rows={3}
              maxLength={2000}
              disabled={saving || uploading}
            />
          </label>

          {/* QRIS Image Management Area */}
          <div style={{ marginBottom: "1.5rem" }}>
            <span style={{ display: "block", fontWeight: 500, marginBottom: "0.5rem" }}>
              Gambar QRIS
            </span>

            {imageUrl ? (
              <div
                style={{
                  display: "flex",
                  gap: "1.5rem",
                  alignItems: "center",
                  padding: "1rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-control)",
                  backgroundColor: "var(--surface)",
                  marginBottom: "0.75rem",
                }}
              >
                <div
                  style={{
                    width: "160px",
                    height: "160px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-control)",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#ffffff",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Preview QRIS"
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <p className="small-note" style={{ margin: 0 }}>
                    {uploading
                      ? `Mengunggah... ${uploadProgress !== null ? `${uploadProgress}%` : ""}`
                      : "Gambar QRIS tersimpan dan siap digunakan."}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={saving || uploading}
                    >
                      Ganti Gambar
                    </button>
                    <button
                      type="button"
                      className="text-link"
                      onClick={handleRemoveImage}
                      disabled={saving || uploading}
                      style={{ color: "var(--danger)" }}
                    >
                      Hapus Gambar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="upload-drop"
                style={{
                  textAlign: "center",
                  border: "2px dashed var(--border)",
                  padding: "2rem",
                  borderRadius: "var(--radius-control)",
                  backgroundColor: "var(--surface)",
                  marginBottom: "0.75rem",
                  cursor: "pointer",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <p style={{ margin: 0, fontWeight: 500 }}>
                  {uploading
                    ? `Mengunggah gambar... ${uploadProgress !== null ? `${uploadProgress}%` : ""}`
                    : "Klik untuk memilih gambar QRIS"}
                </p>
                <p className="small-note" style={{ margin: "0.5rem 0 0" }}>
                  Format JPG, PNG, atau WebP (maks. 10 MB)
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              style={{ display: "none" }}
              disabled={saving || uploading}
            />
          </div>

          <label className="checkbox-label" style={{ marginBottom: "1.5rem" }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => {
                if (e.target.checked && !imageKey) {
                  setError("Unggah gambar QRIS terlebih dahulu sebelum mengaktifkan QRIS.");
                  return;
                }
                setError(null);
                setActive(e.target.checked);
              }}
              disabled={saving || uploading}
            />
            <span>Aktifkan metode pembayaran QRIS</span>
          </label>

          <div className="editor-actions">
            <button
              type="submit"
              className="primary-action"
              disabled={saving || uploading}
            >
              {saving ? "Menyimpan…" : "Simpan Pengaturan QRIS"}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
