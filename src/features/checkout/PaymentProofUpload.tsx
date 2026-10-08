"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export function PaymentProofUpload({ publicToken }: { publicToken: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const validMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!validMimes.includes(selected.type)) {
      setError("Format file tidak didukung. Gunakan JPG, PNG, atau WebP.");
      setFile(null);
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("Ukuran file maksimal 10 MB.");
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    try {
      // 1. Authorize Upload
      const authRes = await fetch(`/api/order/${publicToken}/payment-proof/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mime: file.type, bytes: file.size }),
      });
      if (!authRes.ok) {
        const errorData = await authRes.json();
        throw new Error(errorData.message || "Gagal mengotorisasi unggahan.");
      }
      const { url, key, headers, signature } = await authRes.json();

      // 2. Direct Upload to Private R2
      const uploadRes = await fetch(url, {
        method: "PUT",
        headers,
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error("Gagal mengunggah file bukti pembayaran.");
      }

      // 3. Complete Upload
      const completeRes = await fetch(`/api/order/${publicToken}/payment-proof/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, signature }),
      });
      if (!completeRes.ok) {
        const errorData = await completeRes.json();
        throw new Error(errorData.message || "Gagal memproses bukti pembayaran.");
      }

      // Upload success, refresh order page
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Terjadi kesalahan yang tidak terduga.");
      } else {
        setError("Terjadi kesalahan yang tidak terduga.");
      }
      setIsUploading(false);
    }
  };

  return (
    <div style={{ marginTop: "1.5rem", padding: "1.5rem", border: "1px dashed var(--border)", borderRadius: "var(--radius-control)" }}>
      <h3 style={{ marginBottom: "1rem" }}>Unggah Bukti Pembayaran</h3>
      <p style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
        Setelah melakukan transfer, unggah foto bukti transfer (maks. 10MB) dalam format JPG, PNG, atau WebP.
      </p>
      
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={isUploading}
        ref={fileInputRef}
        style={{ marginBottom: "1rem", display: "block" }}
      />
      
      {file && (
        <div style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
          File terpilih: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </div>
      )}

      {error && (
        <div style={{ color: "var(--error)", marginBottom: "1rem", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      <button
        type="button"
        className="button button-primary"
        onClick={handleUpload}
        disabled={!file || isUploading}
        style={{ width: "100%" }}
      >
        {isUploading ? "Mengunggah..." : "Unggah Bukti Transfer"}
      </button>
    </div>
  );
}
