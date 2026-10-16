"use client";

import { useState } from "react";
import { WhatsAppIcon } from "./Icons";

interface WhatsAppConfirmationProps {
  publicToken: string;
  isMandatory?: boolean;
  orderNumber?: string;
  className?: string;
}

export function WhatsAppConfirmation({
  publicToken,
  isMandatory = false,
  orderNumber,
  className = "",
}: WhatsAppConfirmationProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasClicked, setHasClicked] = useState(false);

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
      setHasClicked(true);
      try {
        localStorage.setItem(`wa_confirmed_${publicToken}`, "true");
      } catch {
        // ignore
      }
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

  if (isMandatory) {
    return (
      <section
        aria-label="Wajib Konfirmasi WhatsApp"
        className={`wa-mandatory-card ${className}`}
        style={{
          marginTop: "1.5rem",
          padding: "clamp(1.25rem, 3vw, 1.75rem)",
          border: "2px solid #22c55e",
          borderRadius: "10px",
          backgroundColor: "#f0fdf4",
          boxShadow: "0 4px 16px rgba(34, 197, 94, 0.12)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.25rem 0.625rem",
            backgroundColor: "#dcfce7",
            border: "1px solid #86efac",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 800,
            letterSpacing: "0.06em",
            color: "#15803d",
            marginBottom: "0.875rem",
            textTransform: "uppercase",
          }}
        >
          <span>⚡</span>
          <span>Langkah Terakhir: Wajib Konfirmasi</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "0.625rem",
          }}
        >
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              backgroundColor: "#25d366",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(37, 211, 102, 0.35)",
            }}
          >
            <WhatsAppIcon size={22} />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#14532d",
                lineHeight: 1.3,
              }}
            >
              Chat Admin via WhatsApp
            </h3>
            <span
              style={{
                fontSize: "0.8125rem",
                color: "#166534",
                fontWeight: 500,
              }}
            >
              Pesanan {orderNumber ? `No. ${orderNumber}` : ""} &bull;
              Verifikasi Langsung
            </span>
          </div>
        </div>

        <p
          style={{
            margin: "0 0 1.25rem",
            fontSize: "0.9125rem",
            color: "#1f2937",
            lineHeight: 1.55,
          }}
        >
          Bukti transfer Anda telah tersimpan di sistem.{" "}
          <strong>
            Agar pesanan segera diverifikasi dan paket Anda langsung disiapkan
            hari ini
          </strong>
          , silakan klik tombol di bawah untuk mengirim pesan konfirmasi ke
          WhatsApp Admin toko.
        </p>

        {error && (
          <div
            style={{
              color: "#b91c1c",
              backgroundColor: "#fef2f2",
              padding: "0.625rem 0.875rem",
              borderRadius: "6px",
              marginBottom: "1rem",
              fontSize: "0.875rem",
              border: "1px solid #fecaca",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          style={{
            display: "inline-flex",
            width: "100%",
            minHeight: "52px",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            padding: "0.875rem 1.5rem",
            backgroundColor: "#25d366",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: loading ? "wait" : "pointer",
            boxShadow: "0 4px 14px rgba(37, 211, 102, 0.35)",
            transition: "all 0.2s ease",
            touchAction: "manipulation",
          }}
        >
          <WhatsAppIcon size={22} />
          <span>
            {loading
              ? "Menyiapkan WhatsApp..."
              : hasClicked
                ? "Buka WhatsApp Lagi (Kirim Konfirmasi)"
                : "Klik Di Sini: Chat Admin via WhatsApp"}
          </span>
        </button>

        {hasClicked && (
          <div
            style={{
              marginTop: "0.875rem",
              padding: "0.625rem 0.875rem",
              backgroundColor: "#dcfce7",
              borderRadius: "6px",
              border: "1px solid #bbf7d0",
              fontSize: "0.8125rem",
              color: "#166534",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              lineHeight: 1.4,
            }}
          >
            <span>✓</span>
            <span>
              Tautan WhatsApp telah dibuka. Jika aplikasi WhatsApp Anda tidak
              terbuka otomatis, silakan klik tombol di atas kembali.
            </span>
          </div>
        )}
      </section>
    );
  }

  // Standard non-mandatory state
  return (
    <div
      className={className}
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
        pesanan Anda? Kirim pesan langsung ke Admin WhatsApp kami dengan format
        pesanan yang sudah terisi otomatis.
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
          touchAction: "manipulation",
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
