"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, errorText } from "./http";
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
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function moderate(next: "approved" | "rejected") {
    if (
      !window.confirm(
        next === "approved"
          ? "Tampilkan ulasan ini di toko?"
          : "Tolak ulasan ini dan sembunyikan dari toko?",
      )
    )
      return;
    setBusy(true);
    setError("");
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
            className="text-link"
            disabled={busy}
            onClick={() => void moderate("approved")}
          >
            Setujui ulasan
          </button>
        )}
        {status !== "rejected" && (
          <button
            className="text-link"
            disabled={busy}
            onClick={() => void moderate("rejected")}
          >
            Tolak ulasan
          </button>
        )}
      </div>
    </>
  );
}
