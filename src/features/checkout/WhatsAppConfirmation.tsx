"use client";

import { useState } from "react";


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
    <div style={{ marginTop: "1.5rem", padding: "1.5rem", border: "1px dashed var(--border)", borderRadius: "var(--radius-control)", backgroundColor: "var(--surface-background)" }}>
      <h3 style={{ marginBottom: "0.5rem" }}>Konfirmasi via WhatsApp</h3>
      <p style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
        Kirim detail pesanan dan tautan bukti pembayaran ke WhatsApp toko untuk membantu proses pengecekan.
      </p>
      {error && (
        <div style={{ color: "var(--error)", marginBottom: "1rem", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}
      <button 
        type="button" 
        className="button button-primary" 
        style={{ width: "100%" }} 
        onClick={handleConfirm}
        disabled={loading}
      >
        {loading ? "Memproses..." : "Konfirmasi via WhatsApp"}
      </button>
    </div>
  );
}
