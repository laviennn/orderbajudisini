"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main id="main-content">
      <h1>Data belum dapat dimuat.</h1>
      <p>
        Pastikan akun Anda memiliki izin untuk modul ini. Jika akses sesuai,
        coba muat ulang.
      </p>
      <button className="primary-action" onClick={reset}>
        Coba lagi
      </button>
    </main>
  );
}
