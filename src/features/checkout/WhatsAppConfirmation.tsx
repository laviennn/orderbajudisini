"use client";

import { useState } from "react";
import { WhatsAppIcon } from "./Icons";

export function WhatsAppConfirmation({ publicToken }: { publicToken: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/order/${publicToken}/whatsapp`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Gagal membuat pesan WhatsApp.");
      }
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Gagal membuat pesan WhatsApp.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: "1.25rem",
        padding: "1.25rem 1.5rem",
        border: "1px solid #bbf7d0",
        borderRadius: "8px",
        backgroundColor: "#f0fdf4",
        boxShadow: "0 1px 3px rgba(34, 197, 94, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.5rem",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            backgroundColor: "#25d366",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            flexShrink: 0,
          }}
        >
          <WhatsAppIcon size={18} />
        </div>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "1rem",
              fontWeight: 700,
              color: "#166534",
            }}
          >
            Konfirmasi Pesanan via WhatsApp
          </h3>
          <span
            style={{ fontSize: "0.75rem", color: "#15803d", fontWeight: 500 }}
          >
            Respon Cepat &bull; Bantuan Langsung dari Admin
          </span>
        </div>
      </div>
      <p
        style={{
          margin: "0.5rem 0 1rem",
          fontSize: "0.875rem",
          color: "#374151",
          lineHeight: 1.5,
        }}
      >
        Ingin verifikasi lebih cepat atau punya pertanyaan khusus mengenai
        pesanan Anda? Kirim pesan langsung ke Admin WhatsApp kami dengan pesan
        otomatis yang sudah terisi.
      </p>
      {error && (
        <div
          style={{
            color: "var(--danger, #ef4444)",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            padding: "0.5rem 0.75rem",
            borderRadius: "6px",
            marginBottom: "1rem",
            fontSize: "0.875rem",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          {error}
        </div>
      )}
      <button
        type="button"
        className="button-whatsapp"
        onClick={handleConfirm}
        disabled={loading}
        style={{
          display: "inline-flex",
          width: "100%",
          minHeight: "48px",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.625rem",
          padding: "0.75rem 1.5rem",
          backgroundColor: "#25d366",
          color: "#ffffff",
          border: "none",
          borderRadius: "6px",
          fontWeight: 700,
          fontSize: "0.95rem",
          cursor: loading ? "wait" : "pointer",
          boxShadow: "0 2px 8px rgba(37, 211, 102, 0.28)",
          transition: "all 0.2s ease",
        }}
      >
        <WhatsAppIcon size={20} />
        <span>
          {loading ? "Menyiapkan WhatsApp..." : "Chat Admin via WhatsApp"}
        </span>
      </button>
    </div>
  );
}
