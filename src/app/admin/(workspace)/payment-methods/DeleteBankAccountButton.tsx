"use client";

import { useState, useRef } from "react";
import { AdminModal } from "@/features/admin/AdminModal";

export function DeleteBankAccountButton() {
  const [isOpen, setIsOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleConfirm() {
    setIsOpen(false);
    btnRef.current?.closest("form")?.requestSubmit();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="text-link"
        style={{ color: "var(--danger)" }}
        onClick={() => setIsOpen(true)}
      >
        Hapus Rekening
      </button>

      <AdminModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Hapus Rekening Bank?"
        subtitle="Konfirmasi penghapusan data rekening pembayaran"
        variant="danger"
        footer={
          <>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-cancel"
              onClick={() => setIsOpen(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="admin-modal-btn admin-modal-btn-danger"
              onClick={handleConfirm}
            >
              Ya, Hapus Rekening
            </button>
          </>
        }
      >
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Apakah Anda yakin ingin menghapus rekening bank ini? Rekening ini
          tidak akan lagi ditampilkan sebagai metode pembayaran di halaman
          checkout.
        </p>
      </AdminModal>
    </>
  );
}
