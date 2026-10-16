"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, errorText } from "./http";
import { AdminModal } from "./AdminModal";

export function ReviewActions({
  id,
  status,
  updatedAt,
}: {
  id: string;
  status: string;
  updatedAt: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "approved" | "rejected" | null
  >(null);

  async function executeModerate(next: "approved" | "rejected") {
    setBusy(true);
    setError("");
    setPendingAction(null);
    try {
      await adminRequest("/api/admin/reviews", { id, status: next, updatedAt });
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <div className="editor-actions">
        {status !== "approved" && (
          <button
            type="button"
            className="text-link"
            style={{ color: "#16a34a" }}
            disabled={busy}
            onClick={() => setPendingAction("approved")}
          >
            Setujui ulasan
          </button>
        )}
        {status !== "rejected" && (
          <button
            type="button"
            className="text-link"
            style={{ color: "#dc2626" }}
            disabled={busy}
            onClick={() => setPendingAction("rejected")}
          >
            Tolak ulasan
          </button>
        )}
      </div>

      <AdminModal
        isOpen={Boolean(pendingAction)}
        onClose={() => !busy && setPendingAction(null)}
        title={
          pendingAction === "approved" ? "Setujui Ulasan?" : "Tolak Ulasan?"
        }
        subtitle="Moderasi ulasan produk dari pelanggan"
        variant={pendingAction === "approved" ? "success" : "danger"}
        footer={
          <>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-cancel"
              disabled={busy}
              onClick={() => setPendingAction(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className={
                pendingAction === "approved"
                  ? "admin-modal-btn admin-modal-btn-success"
                  : "admin-modal-btn admin-modal-btn-danger"
              }
              disabled={busy}
              onClick={() =>
                pendingAction && void executeModerate(pendingAction)
              }
            >
              {busy
                ? "Memproses..."
                : pendingAction === "approved"
                  ? "Ya, Tampilkan Ulasan"
                  : "Ya, Tolak Ulasan"}
            </button>
          </>
        }
      >
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          {pendingAction === "approved"
            ? "Ulasan ini akan disetujui dan langsung ditampilkan pada halaman detail produk di etalase toko."
            : "Ulasan ini akan ditolak dan disembunyikan dari halaman detail produk toko."}
        </p>
      </AdminModal>
    </>
  );
}
