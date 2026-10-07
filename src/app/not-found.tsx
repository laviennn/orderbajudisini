import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="page-width py-16">
      <p className="eyebrow mb-4">404</p>
      <h1 className="font-serif text-3xl">Halaman tidak ditemukan.</h1>
      <Link href="/" className="text-link mt-6">
        Kembali ke halaman utama
      </Link>
    </main>
  );
}
