"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { authorizeBankLogoUploadAction } from "@/app/admin/(workspace)/payment-methods/actions";

interface BankLogoUploadProps {
  initialKey?: string | null;
  initialUrl?: string | null;
  bankName?: string;
}

export function BankLogoUpload({
  initialKey,
  initialUrl,
  bankName = "Bank",
}: BankLogoUploadProps) {
  const [logoKey, setLogoKey] = useState<string | null>(initialKey || null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialUrl || null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/svg+xml",
    ];
    if (!validTypes.includes(file.type)) {
      setError("Format file harus JPG, PNG, atau WebP.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Ukuran logo maksimal 10 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setLogoUrl(localUrl);
    setUploading(true);
    setProgress(0);

    try {
      const signed = await authorizeBankLogoUploadAction({
        mime: file.type,
        bytes: file.size,
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.url);
        xhr.timeout = 120000;
        for (const [header, val] of Object.entries(signed.headers)) {
          xhr.setRequestHeader(header, val);
        }
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("Gagal mengunggah logo ke penyimpanan."));
          }
        };
        xhr.onerror = xhr.ontimeout = () => {
          reject(new Error("Gagal mengunggah logo ke penyimpanan R2."));
        };
        xhr.send(file);
      });

      setLogoKey(signed.key);
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah logo.");
      setLogoKey(initialKey || null);
      setLogoUrl(initialUrl || null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    setLogoKey(null);
    setLogoUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <label
        style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}
      >
        Logo Bank (Opsional)
      </label>
      <input type="hidden" name="logoObjectKey" value={logoKey || ""} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
          flexWrap: "wrap",
          padding: "1rem",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-control)",
          backgroundColor: "var(--surface-subtle)",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "48px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            padding: "4px",
            position: "relative",
          }}
        >
          {logoUrl ? (
            <Image
              unoptimized
              src={logoUrl}
              alt={`Logo ${bankName}`}
              width={72}
              height={40}
              style={{ objectFit: "contain", maxHeight: "100%", width: "auto" }}
            />
          ) : (
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--muted-foreground)",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              Tanpa Logo
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0.875rem",
              borderRadius: "var(--radius-control)",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              cursor: uploading ? "not-allowed" : "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
              margin: 0,
            }}
          >
            <span>
              {uploading
                ? `Mengunggah (${progress ?? 0}%)`
                : logoUrl
                  ? "Ganti Logo"
                  : "Upload Logo"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>

          {logoUrl && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-link"
              style={{ fontSize: "0.875rem", color: "var(--danger)" }}
            >
              Hapus Logo
            </button>
          )}
        </div>
      </div>

      {error && (
        <p
          style={{
            color: "var(--danger)",
            fontSize: "0.8125rem",
            marginTop: "0.375rem",
          }}
        >
          {error}
        </p>
      )}
      {uploading && (
        <p
          style={{
            color: "var(--muted-foreground)",
            fontSize: "0.8125rem",
            marginTop: "0.375rem",
          }}
        >
          Mengunggah gambar ke cloud storage...
        </p>
      )}
    </div>
  );
}
