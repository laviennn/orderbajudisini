"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, errorText } from "@/features/admin/http";
export default function PaymentActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function run(action: "verify" | "reject", body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminRequest(`/api/admin/payments/${paymentId}/${action}`, body);
      setMessage(
        action === "verify"
          ? "Pembayaran terverifikasi. Pesanan siap diproses."
          : "Pembayaran ditolak. Pembeli dapat mengirim ulang bukti sebelum batas pembayaran.",
      );
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function reject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
    if (window.confirm("Tolak bukti pembayaran dengan alasan ini?"))
      void run("reject", { reason });
  }
  return (
    <div className="admin-editor">
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <button
        className="primary-action"
        disabled={busy}
        onClick={() => {
          if (
            window.confirm(
              "Konfirmasi dana telah diterima sesuai total pesanan?",
            )
          )
            void run("verify", {});
        }}
      >
        Verifikasi pembayaran
      </button>
      <form onSubmit={reject}>
        <fieldset disabled={busy}>
          <label>
            Alasan penolakan
            <textarea name="reason" required maxLength={1000} />
          </label>
          <button className="text-link">Tolak pembayaran</button>
        </fieldset>
      </form>
    </div>
  );
}
