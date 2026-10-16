"use client";

import { useState } from "react";

interface DownloadQrisButtonProps {
  imageUrl: string;
  merchantName?: string | null;
  orderNumber?: string;
  publicToken?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function DownloadQrisButton({
  imageUrl,
  merchantName,
  orderNumber,
  publicToken,
  className = "",
  style = {},
}: DownloadQrisButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);

    const safeOrder = orderNumber ? `-${orderNumber}` : "";
    const safeMerchant = merchantName
      ? `-${merchantName.trim().replace(/[^a-zA-Z0-9_-]/g, "_")}`
      : "";
    const filename = `QRIS${safeMerchant}${safeOrder}.png`;

    try {
      // 1. Prefer same-origin download proxy to eliminate CORS restrictions
      const fetchUrl = publicToken
        ? `/api/order/${publicToken}/qris-download`
        : imageUrl;

      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error("Gagal mengambil file QRIS");
      const blob = await response.blob();
      const mimeType = blob.type || "image/png";

      // 2. On iPhone & Mobile: Use Web Share API if supported.
      // This allows iOS users to tap "Save Image" directly into Photos/Galeri!
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        typeof File !== "undefined"
      ) {
        try {
          const file = new File([blob], filename, { type: mimeType });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: "Kode QRIS Pembayaran",
              text: `Kode QRIS Pembayaran pesanan ${orderNumber || ""}`,
            });
            setDownloaded(true);
            setTimeout(() => setDownloaded(false), 3000);
            return;
          }
        } catch (shareErr) {
          // If user cancels share sheet (AbortError), don't trigger error
          if (shareErr instanceof Error && shareErr.name === "AbortError") {
            return;
          }
          // Otherwise continue to direct download below
        }
      }

      // 3. Direct browser download without opening any new tab
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } catch {
      // 4. Safe same-origin fallback without target="_blank"
      if (publicToken) {
        const link = document.createElement("a");
        link.href = `/api/order/${publicToken}/qris-download`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setDownloaded(true);
        setTimeout(() => setDownloaded(false), 3000);
      } else {
        // Direct anchor fallback
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className={`download-qris-btn ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        padding: "0.625rem 1.25rem",
        fontSize: "0.875rem",
        fontWeight: 600,
        color: "#ffffff",
        backgroundColor: downloaded ? "#15803d" : "var(--primary, #354a37)",
        border: "none",
        borderRadius: "6px",
        cursor: downloading ? "wait" : "pointer",
        transition: "all 0.15s ease",
        opacity: downloading ? 0.75 : 1,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
        minHeight: "44px",
        touchAction: "manipulation",
        ...style,
      }}
      title="Simpan QRIS ke galeri untuk discan dari aplikasi m-Banking atau e-Wallet"
    >
      {downloaded ? (
        <>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>QRIS Berhasil Diunduh!</span>
        </>
      ) : (
        <>
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>{downloading ? "Menyiapkan QRIS…" : "Unduh Gambar QRIS"}</span>
        </>
      )}
    </button>
  );
}
