"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, UploadCloudIcon, CameraIcon } from "./Icons";

export function PaymentProofUpload({ publicToken }: { publicToken: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [fileMime, setFileMime] = useState<string>("image/jpeg");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setError(null);
    if (!selected) {
      setFile(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let mime = selected.type.toLowerCase();
    const name = selected.name.toLowerCase();
    if (!mime || mime === "image/jpg" || mime === "image/pjpeg") {
      if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
        mime = "image/jpeg";
      } else if (name.endsWith(".png")) {
        mime = "image/png";
      } else if (name.endsWith(".webp")) {
        mime = "image/webp";
      }
    }

    const validMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!validMimes.includes(mime)) {
      setError(
        "Format file tidak didukung. Harap gunakan foto JPG, PNG, atau WebP.",
      );
      setFile(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("Ukuran foto maksimal 10 MB.");
      setFile(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    setFile(selected);
    setFileMime(mime);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(selected);
    });
  };

  const handleUpload = async () => {
    if (!file) {
      fileInputRef.current?.click();
      return;
    }
    setIsUploading(true);
    setError(null);

    try {
      // 1. Authorize Upload
      const authRes = await fetch(
        `/api/order/${publicToken}/payment-proof/authorize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mime: fileMime, bytes: file.size }),
        },
      );
      if (!authRes.ok) {
        const errorData = await authRes.json().catch(() => ({}));
        throw new Error(errorData.message || "Gagal mengotorisasi unggahan.");
      }
      const { url, key, headers, signature } = await authRes.json();

      // 2. Direct Upload to Private R2
      const uploadHeaders: Record<string, string> = {
        ...(headers || {}),
        "Content-Type": fileMime,
      };

      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: uploadHeaders,
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error(
          "Gagal mengunggah file bukti pembayaran ke storage. Periksa koneksi internet Anda.",
        );
      }

      // 3. Complete Upload
      const completeRes = await fetch(
        `/api/order/${publicToken}/payment-proof/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, signature }),
        },
      );
      if (!completeRes.ok) {
        const errorData = await completeRes.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Gagal memproses bukti pembayaran.",
        );
      }

      // Upload success, refresh order page
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (
          err.name === "TypeError" ||
          err.message.toLowerCase().includes("failed to fetch")
        ) {
          setError(
            "Gagal mengunggah: kendala jaringan atau CORS storage. Silakan coba kembali.",
          );
        } else {
          setError(err.message || "Terjadi kesalahan yang tidak terduga.");
        }
      } else {
        setError("Terjadi kesalahan yang tidak terduga.");
      }
      setIsUploading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: "1.5rem",
        padding: "1.5rem",
        border: "1px solid var(--border, #d4d5cc)",
        background: "#ffffff",
        borderRadius: "8px",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          marginBottom: "0.5rem",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            backgroundColor: "var(--accent, #e3e8dd)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary, #354a37)",
            flexShrink: 0,
          }}
        >
          <CameraIcon size={18} />
        </div>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "var(--foreground, #242922)",
            }}
          >
            Unggah Bukti Pembayaran
          </h3>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--muted-foreground, #62675c)",
            }}
          >
            Maks. 10MB &bull; Format JPG, PNG, atau WebP
          </span>
        </div>
      </div>
      <p
        style={{
          margin: "0.75rem 0 1.25rem",
          fontSize: "0.875rem",
          color: "var(--muted-foreground, #62675c)",
          lineHeight: 1.5,
        }}
      >
        Setelah transfer, lampirkan tangkapan layar (screenshot) m-Banking atau
        foto struk ATM. Pastikan tanggal, nominal, dan nomor rekening penerima
        terlihat jelas.
      </p>

      {/* Hidden native input */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        onChange={handleFileChange}
        disabled={isUploading}
        ref={fileInputRef}
        style={{ display: "none" }}
      />

      {/* Interactive Dropzone / Selector */}
      {!file ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem 1.5rem",
            border: "2px dashed #9ca3af",
            borderRadius: "8px",
            background: "#fafaf9",
            cursor: "pointer",
            textAlign: "center",
            marginBottom: "1.25rem",
            transition: "all 0.2s ease",
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "#ffffff",
              border: "1px solid var(--border, #d4d5cc)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "0.75rem",
              color: "var(--primary, #354a37)",
              boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
            }}
          >
            <UploadCloudIcon size={26} />
          </div>
          <strong
            style={{
              fontSize: "1rem",
              marginBottom: "0.25rem",
              color: "var(--foreground, #242922)",
            }}
          >
            Ketuk untuk Memilih Foto Bukti Transfer
          </strong>
          <span
            style={{
              fontSize: "0.8125rem",
              color: "var(--muted-foreground, #62675c)",
            }}
          >
            Ambil langsung dari kamera atau pilih file galeri
          </span>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "1rem 1.25rem",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            marginBottom: "1.25rem",
          }}
        >
          {previewUrl && (
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "6px",
                overflow: "hidden",
                border: "1px solid #86efac",
                flexShrink: 0,
                background: "#000000",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview bukti transfer"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.925rem",
                color: "#166534",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {file.name}
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "#15803d",
                marginTop: "0.2rem",
                fontWeight: 500,
              }}
            >
              ✓ {(file.size / 1024 / 1024).toFixed(2)} MB &bull; Foto siap
              dikirim
            </div>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              padding: "0.375rem 0.75rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              backgroundColor: "#ffffff",
              border: "1px solid #86efac",
              borderRadius: "4px",
              color: "#166534",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Ganti Foto
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1rem",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid var(--danger, #ef4444)",
            borderRadius: "6px",
            color: "var(--danger, #ef4444)",
            marginBottom: "1.25rem",
            fontSize: "0.875rem",
          }}
        >
          <AlertCircleIcon size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Action Button with prominent high contrast */}
      <button
        type="button"
        className="button-primary"
        onClick={handleUpload}
        disabled={isUploading}
        style={{
          width: "100%",
          minHeight: "50px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "0.75rem 1.5rem",
          backgroundColor: file ? "var(--primary, #354a37)" : "#ffffff",
          color: file ? "#ffffff" : "var(--primary, #354a37)",
          border: file
            ? "1px solid var(--primary, #354a37)"
            : "2px solid var(--primary, #354a37)",
          borderRadius: "6px",
          fontWeight: 700,
          fontSize: "1rem",
          cursor: isUploading ? "wait" : "pointer",
          boxShadow: file
            ? "0 4px 12px rgba(53, 74, 55, 0.25)"
            : "0 1px 3px rgba(0, 0, 0, 0.08)",
          transition: "all 0.2s ease",
        }}
      >
        {isUploading ? (
          <>
            <UploadCloudIcon size={20} />
            <span>Mengunggah Bukti Pembayaran...</span>
          </>
        ) : !file ? (
          <>
            <CameraIcon size={20} />
            <span>Pilih Foto Bukti Transfer</span>
          </>
        ) : (
          <>
            <UploadCloudIcon size={20} />
            <span>Kirim Bukti Pembayaran Sekarang</span>
          </>
        )}
      </button>
    </div>
  );
}
