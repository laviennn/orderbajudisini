"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, errorText } from "@/features/admin/http";
import { AdminModal } from "@/features/admin/AdminModal";

const REJECTION_PRESETS = [
  "Nominal transfer tidak sesuai tagihan",
  "Bukti transfer buram atau tidak terbaca",
  "Mutasi bank belum terdeteksi masuk",
  "Rekening tujuan transfer tidak sesuai",
];

export default function PaymentActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function run(action: "verify" | "reject", body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminRequest(`/api/admin/payments/${paymentId}/${action}`, body);
      setMessage(
        action === "verify"
          ? "Pembayaran terverifikasi. Pesanan siap diproses."
          : "Pembayaran ditolak. Pembeli dapat mengirim ulang bukti pembayaran.",
      );
      setShowVerifyModal(false);
      setShowRejectModal(false);
      setRejectReason("");
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function handleConfirmVerify() {
    void run("verify", {});
  }

  function handleConfirmReject() {
    if (!rejectReason.trim()) return;
    void run("reject", { reason: rejectReason.trim() });
  }

  return (
    <div className="admin-payment-actions" style={{ marginTop: "0.5rem" }}>
      {error && (
        <p
          role="alert"
          className="admin-error"
          style={{ marginBottom: "1rem" }}
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            backgroundColor: "#f0fdf4",
            color: "#166534",
            border: "1px solid #bbf7d0",
            fontWeight: 500,
          }}
        >
          {message}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="admin-action-btn admin-action-btn-verify"
          disabled={busy}
          onClick={() => setShowVerifyModal(true)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Verifikasi Pembayaran
        </button>

        <button
          type="button"
          className="admin-action-btn admin-action-btn-reject"
          disabled={busy}
          onClick={() => setShowRejectModal(true)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          Tolak Bukti Pembayaran
        </button>
      </div>

      {/* Modal Verifikasi Pembayaran */}
      <AdminModal
        isOpen={showVerifyModal}
        onClose={() => !busy && setShowVerifyModal(false)}
        title="Verifikasi Pembayaran"
        subtitle="Konfirmasi bahwa dana pembayaran telah diterima"
        variant="success"
        icon={
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        }
        footer={
          <>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-cancel"
              disabled={busy}
              onClick={() => setShowVerifyModal(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-success"
              disabled={busy}
              onClick={handleConfirmVerify}
            >
              {busy ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="animate-spin"
                  >
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                  Memproses...
                </>
              ) : (
                "Ya, Verifikasi Pembayaran"
              )}
            </button>
          </>
        }
      >
        <p style={{ margin: "0 0 1rem", lineHeight: 1.6 }}>
          Pastikan nominal dana yang masuk ke mutasi rekening bank / QRIS toko
          sudah sesuai dengan total pesanan.
        </p>
        <div
          style={{
            backgroundColor: "#f8f7f3",
            border: "1px solid #d4d5cc",
            borderRadius: "8px",
            padding: "0.875rem 1rem",
            fontSize: "0.85rem",
            color: "#62675c",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: "#242922" }}>
            Dampak verifikasi:
          </p>
          <ul
            style={{
              margin: "0.5rem 0 0",
              paddingLeft: "1.25rem",
              lineHeight: 1.5,
            }}
          >
            <li>Status pesanan berubah menjadi Lunas & Siap Diproses.</li>
            <li>Stok produk dikonfirmasi terjual (sold).</li>
            <li>Pelanggan dapat memantau status pesanan diperbarui.</li>
          </ul>
        </div>
      </AdminModal>

      {/* Modal Tolak Bukti Pembayaran */}
      <AdminModal
        isOpen={showRejectModal}
        onClose={() => !busy && setShowRejectModal(false)}
        title="Tolak Bukti Pembayaran"
        subtitle="Berikan alasan penolakan yang jelas kepada pembeli"
        variant="danger"
        icon={
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        }
        footer={
          <>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-cancel"
              disabled={busy}
              onClick={() => setShowRejectModal(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-danger"
              disabled={busy || !rejectReason.trim()}
              onClick={handleConfirmReject}
            >
              {busy ? "Memproses..." : "Tolak Bukti Ini"}
            </button>
          </>
        }
      >
        <div style={{ marginBottom: "1rem" }}>
          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#62675c",
            }}
          >
            Pilihan Alasan Cepat (Klik untuk memilih):
          </p>
          <div className="admin-chip-group">
            {REJECTION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`admin-chip ${rejectReason === preset ? "active" : ""}`}
                onClick={() => setRejectReason(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          <span
            style={{
              display: "block",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "0.375rem",
            }}
          >
            Alasan Penolakan <span style={{ color: "#dc2626" }}>*</span>
          </span>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            required
            maxLength={1000}
            rows={3}
            placeholder="Tuliskan alasan penolakan secara spesifik..."
            style={{
              width: "100%",
              padding: "0.625rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              fontSize: "0.875rem",
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </label>
        <p
          style={{
            margin: "0.25rem 0 0",
            fontSize: "0.75rem",
            color: "#62675c",
          }}
        >
          Pembeli akan dapat melihat alasan ini dan diberikan kesempatan untuk
          mengunggah ulang bukti pembayaran.
        </p>
      </AdminModal>
    </div>
  );
}
