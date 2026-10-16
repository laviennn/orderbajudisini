"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { OrderState } from "@/lib/domain/states";
import { adminRequest, errorText } from "@/features/admin/http";
import { AdminModal } from "@/features/admin/AdminModal";

export default function OrderActions({
  orderId,
  status,
  defaultCourier,
  defaultService,
  trackingNumber,
  canUpdate,
  canShip,
}: {
  orderId: string;
  status: OrderState;
  defaultCourier: string;
  defaultService: string;
  trackingNumber: string | null;
  canUpdate: boolean;
  canShip: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  async function run(action: string, body: unknown = {}) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminRequest(`/api/admin/orders/${orderId}/${action}`, body);
      setMessage("Perubahan pesanan tersimpan.");
      setConfirmCancelOpen(false);
      setConfirmCompleteOpen(false);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function ship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run("ship", Object.fromEntries(data));
  }

  return (
    <section className="admin-editor" aria-label="Tindakan pesanan">
      {error && (
        <p role="alert" className="admin-error">
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
        className="editor-actions"
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {canUpdate && status === "payment_verified" && (
          <button
            className="primary-action"
            disabled={busy}
            onClick={() => void run("process")}
          >
            Proses pesanan
          </button>
        )}
        {canUpdate && status === "shipped" && (
          <button
            className="primary-action"
            disabled={busy}
            onClick={() => setConfirmCompleteOpen(true)}
          >
            Selesaikan pesanan
          </button>
        )}
        {canUpdate &&
          ["pending_payment", "payment_submitted"].includes(status) && (
            <button
              className="text-link"
              disabled={busy}
              onClick={() => setConfirmCancelOpen(true)}
              style={{ color: "#dc2626" }}
            >
              Batalkan pesanan
            </button>
          )}
      </div>

      {/* Modal Konfirmasi Pembatalan Pesanan */}
      <AdminModal
        isOpen={confirmCancelOpen}
        onClose={() => !busy && setConfirmCancelOpen(false)}
        title="Batalkan Pesanan?"
        subtitle="Tindakan ini akan mengembalikan stok produk"
        variant="danger"
        footer={
          <>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-cancel"
              disabled={busy}
              onClick={() => setConfirmCancelOpen(false)}
            >
              Kembali
            </button>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-danger"
              disabled={busy}
              onClick={() => void run("cancel")}
            >
              {busy ? "Membatalkan..." : "Ya, Batalkan Pesanan"}
            </button>
          </>
        }
      >
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Pesanan ini belum selesai dibayar. Jika dibatalkan:
        </p>
        <ul
          style={{
            margin: "0.5rem 0 0",
            paddingLeft: "1.25rem",
            color: "#62675c",
            fontSize: "0.875rem",
          }}
        >
          <li>Reservasi stok produk akan dilepaskan kembali ke katalog.</li>
          <li>
            Status pesanan berubah menjadi <strong>Batal (Cancelled)</strong>.
          </li>
        </ul>
      </AdminModal>

      {/* Modal Konfirmasi Penyelesaian Pesanan */}
      <AdminModal
        isOpen={confirmCompleteOpen}
        onClose={() => !busy && setConfirmCompleteOpen(false)}
        title="Selesaikan Pesanan?"
        subtitle="Konfirmasi bahwa pesanan telah diterima pembeli"
        variant="success"
        footer={
          <>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-cancel"
              disabled={busy}
              onClick={() => setConfirmCompleteOpen(false)}
            >
              Kembali
            </button>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-success"
              disabled={busy}
              onClick={() => void run("complete")}
            >
              {busy ? "Memproses..." : "Ya, Selesaikan Pesanan"}
            </button>
          </>
        }
      >
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Konfirmasi bahwa produk telah sampai ke tangan pembeli dengan baik.
          Pesanan akan ditandai sebagai <strong>Selesai (Completed)</strong>.
        </p>
      </AdminModal>
      {canShip && ["processing", "shipped"].includes(status) && (
        <form onSubmit={ship}>
          <fieldset disabled={busy}>
            <legend>
              {status === "shipped" ? "Koreksi pengiriman" : "Kirim pesanan"}
            </legend>
            <div className="editor-grid">
              <label>
                Kurir
                <input
                  name="courier"
                  required
                  maxLength={100}
                  defaultValue={defaultCourier}
                />
              </label>
              <label>
                Layanan
                <input
                  name="service"
                  required
                  maxLength={100}
                  defaultValue={defaultService}
                />
              </label>
              <label>
                Nomor resi
                <input
                  name="trackingNumber"
                  required
                  maxLength={120}
                  defaultValue={trackingNumber ?? ""}
                />
              </label>
            </div>
            <button className="primary-action">
              {busy ? "Menyimpan…" : "Simpan pengiriman"}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
