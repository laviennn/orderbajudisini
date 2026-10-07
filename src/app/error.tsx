"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="page-width py-16">
      <h1 className="font-serif text-3xl">Halaman belum dapat dimuat.</h1>
      <p className="mt-4 text-muted-foreground">
        Coba muat ulang halaman beberapa saat lagi.
      </p>
      <button className="primary-action mt-6" onClick={reset}>
        Coba lagi
      </button>
    </main>
  );
}
