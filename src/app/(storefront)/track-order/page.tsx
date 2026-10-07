import Link from "next/link";
export const metadata = {
  title: "Lacak pesanan",
  robots: { index: false, follow: false },
};
export default function TrackOrder() {
  return (
    <main id="main-content" className="page-width section-space">
      <h1>Pelacakan belum tersedia.</h1>
      <p>Fitur pelacakan akan tersedia setelah pemesanan dibuka.</p>
      <Link className="text-link" href="/products">
        Kembali ke katalog
      </Link>
    </main>
  );
}
