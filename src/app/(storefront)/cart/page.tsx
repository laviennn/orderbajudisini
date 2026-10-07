import { Cart } from "@/features/cart/Cart";
export const metadata = {
  title: "Keranjang",
  robots: { index: false, follow: false },
};
export default function CartPage() {
  return (
    <main id="main-content" className="page-width section-space">
      <p className="eyebrow">Pilihan Anda</p>
      <h1>Keranjang</h1>
      <Cart />
    </main>
  );
}
