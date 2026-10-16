"use client";

import { useState } from "react";

interface DownloadQrisButtonProps {
  imageUrl: string;
  merchantName?: string | null;
  orderNumber?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function DownloadQrisButton({
  imageUrl,
  merchantName,
  orderNumber,
  className = "",
  style = {},
}: DownloadQrisButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);

    try {
      // Fetch the image as a Blob so it downloads directly with a clean filename
      const response = await fetch(imageUrl, { mode: "cors" });
      if (!response.ok) throw new Error("Gagal mengambil gambar QRIS");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const safeOrder = orderNumber ? `-${orderNumber}` : "";
      const safeMerchant = merchantName ? `-${merchantName.trim().replace(/[^a-zA-Z0-9_-]/g, "_")}` : "";
      const filename = `QRIS${safeMerchant}${safeOrder}.png`;

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      // Fallback: If blob fetch is blocked by CORS, trigger direct anchor download or open in new tab
      const link = document.createElement("a");
      link.href = imageUrl;
      link.target = "_blank";
      link.download = `QRIS-OrderBajuDisini${orderNumber ? `-${orderNumber}` : ""}.png`;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
        backgroundColor: "var(--primary, #354a37)",
        border: "none",
        borderRadius: "6px",
        cursor: downloading ? "wait" : "pointer",
        transition: "all 0.15s ease",
        opacity: downloading ? 0.75 : 1,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
        ...style,
      }}
      title="Unduh QRIS untuk discan dari galeri m-Banking / e-Wallet"
    >
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
      <span>{downloading ? "Mengunduh QRIS…" : "Unduh Gambar QRIS"}</span>
    </button>
  );
}
