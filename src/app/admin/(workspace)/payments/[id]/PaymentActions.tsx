"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PaymentActions({
  paymentId,
  orderId,
}: {
  paymentId: string;
  orderId: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    if (!confirm("Apakah Anda yakin ingin memverifikasi pembayaran ini?"))
      return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error?.message || "Gagal memverifikasi pembayaran",
        );
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    const reason = prompt("Masukkan alasan penolakan:");
    if (!reason) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Gagal menolak pembayaran");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="payment-actions"
      style={{ display: "flex", gap: "1rem", flexDirection: "column" }}
    >
      {error && (
        <div className="error-message" style={{ color: "var(--error)" }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: "1rem" }}>
        <button
          className="button button-primary"
          onClick={handleVerify}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Memproses..." : "Verifikasi Pembayaran"}
        </button>
        <button
          className="button button-secondary"
          onClick={handleReject}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Memproses..." : "Tolak Pembayaran"}
        </button>
      </div>
    </div>
  );
}
