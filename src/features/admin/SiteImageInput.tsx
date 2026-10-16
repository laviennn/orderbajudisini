"use client";
import Image from "next/image";
import { useState } from "react";
import { adminRequest, errorText } from "./http";

export function SiteImageInput({
  label,
  value,
  url,
  scope,
  onChange,
  onBusy,
  aspectHint,
}: {
  label: string;
  value: string | null;
  url?: string | null;
  scope: "banner" | "store";
  onChange: (key: string | null, url: string | null) => void;
  onBusy: (busy: boolean) => void;
  aspectHint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    onBusy(true);
    setMessage("Mengunggah gambar…");
    try {
      const signed = await adminRequest<{
        key: string;
        url: string;
        headers: Record<string, string>;
      }>("/api/admin/site-media", {
        scope,
        action: "authorize",
        data: { mime: file.type, bytes: file.size },
      });
      const response = await fetch(signed.url, {
        method: "PUT",
        headers: signed.headers,
        body: file,
      });
      if (!response.ok) throw new Error();
      const accepted = await adminRequest<{ key: string; url: string }>(
        "/api/admin/site-media",
        { scope, action: "complete", data: { key: signed.key } },
      );
      onChange(accepted.key, accepted.url);
      setMessage("✓ Gambar berhasil diunggah.");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
      onBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="site-image-box">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "0.25rem",
        }}
      >
        <span
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--foreground)",
          }}
        >
          {label}
        </span>
        {aspectHint && (
          <span
            style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}
          >
            {aspectHint}
          </span>
        )}
      </div>

      {url ? (
        <div className="site-image-preview-card">
          <div className="site-image-thumb-area">
            <Image
              unoptimized
              src={url}
              alt={label}
              width={180}
              height={104}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
            />
          </div>
          <div className="site-image-actions">
            <label
              style={{ margin: 0, cursor: busy ? "not-allowed" : "pointer" }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--primary)",
                  textDecoration: "underline",
                }}
              >
                {busy ? "Sedang Mengunggah..." : "Ganti gambar"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </label>
            {value && (
              <button
                type="button"
                className="site-image-btn-remove"
                disabled={busy}
                onClick={() => {
                  onChange(null, null);
                  setMessage("");
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Lepas gambar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "1rem",
              border: "1px dashed var(--border)",
              borderRadius: "6px",
              background: "var(--surface)",
              cursor: busy ? "not-allowed" : "pointer",
              textAlign: "center",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--muted-foreground)" }}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--primary)",
              }}
            >
              {busy ? "Mengunggah gambar…" : "+ Pilih Gambar (JPG, PNG, WebP)"}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </label>
        </div>
      )}

      {message && (
        <p
          role="status"
          style={{
            margin: 0,
            fontSize: "0.75rem",
            color: message.startsWith("✓") ? "var(--success)" : "var(--danger)",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
