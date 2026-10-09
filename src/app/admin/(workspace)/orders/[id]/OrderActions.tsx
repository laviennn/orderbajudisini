"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { OrderState } from "@/lib/domain/states";
import { adminRequest, errorText } from "@/features/admin/http";
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
  async function run(action: string, body: unknown = {}) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminRequest(`/api/admin/orders/${orderId}/${action}`, body);
      setMessage("Perubahan pesanan tersimpan.");
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
    if (window.confirm("Simpan informasi pengiriman ini?"))
      void run("ship", Object.fromEntries(data));
  }
  return (
    <section className="admin-editor" aria-label="Tindakan pesanan">
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="editor-actions">
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
            onClick={() => {
              if (window.confirm("Konfirmasi pesanan telah diterima pembeli?"))
                void run("complete");
            }}
          >
            Selesaikan pesanan
          </button>
        )}
        {canUpdate &&
          ["pending_payment", "payment_submitted"].includes(status) && (
            <button
              className="text-link"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Batalkan pesanan belum dibayar dan lepaskan reservasi stok?",
                  )
                )
                  void run("cancel");
              }}
            >
              Batalkan pesanan
            </button>
          )}
      </div>
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
