"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "./store";
import { ProductPhoto } from "@/features/storefront/Interactions";
import type { CartResult } from "@/server/services/cart";
import { formatIdr } from "@/lib/domain/money";
import { trackCommerce } from "@/lib/analytics";
export function Cart() {
  const cart = useCart();
  const key = cart.ids.join(",");
  const [state, setState] = useState<{
    key: string;
    data?: CartResult;
    error?: string;
  }>({ key: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!cart.ready || !key) return;
    const controller = new AbortController();
    let sequence = 0;
    const refresh = () => {
      const requestSequence = ++sequence;
      setState({ key });
      void fetch("/api/cart/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: key.split(",") }),
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const data: CartResult = await response.json();
          if (!controller.signal.aborted && requestSequence === sequence)
            setState({ key, data });
        })
        .catch(() => {
          if (!controller.signal.aborted && requestSequence === sequence)
            setState({
              key,
              error: "Harga belum dapat diperiksa. Silakan coba lagi.",
            });
        });
    };
    refresh();
    trackCommerce("view_cart", key.split(","));
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, retry, cart.ready]);
  if (!cart.ready) return <p role="status">Memuat keranjang…</p>;
  if (!cart.ids.length)
    return (
      <div className="empty-state">
        <h2>Keranjang masih kosong.</h2>
        <p>Temukan produk yang ingin Anda simpan.</p>
        <Link className="primary-action" href="/products">
          Lihat produk
        </Link>
      </div>
    );
  const current = state.key === key ? state : null;
  const data = current?.data;
  const remove = (id: string) => {
    cart.remove(id);
    trackCommerce("remove_from_cart", [id]);
  };
  return (
    <>
      <p className="small-note">
        Produk di keranjang belum dipesan. Ketersediaan dapat berubah.
      </p>
      {!cart.persistent && (
        <p role="status">
          Penyimpanan browser tidak tersedia; keranjang tidak bertahan setelah
          halaman ditutup.
        </p>
      )}
      {current?.error ? (
        <div role="alert">
          <p>{current.error}</p>
          <button className="text-link" onClick={() => setRetry((n) => n + 1)}>
            Coba lagi
          </button>
          <button className="text-link" onClick={cart.clear}>
            Kosongkan keranjang
          </button>
        </div>
      ) : !data ? (
        <p role="status">Memeriksa harga dan ketersediaan…</p>
      ) : (
        <div className="cart-layout">
          <div>
            <ul className="cart-lines">
              {data.items.map((item) => (
                <li key={item.id}>
                  <div className="cart-photo">
                    <ProductPhoto image={item.image} sizes="80px" />
                  </div>
                  <div>
                    <h2>
                      {item.slug ? (
                        <Link href={`/products/${item.slug}`}>{item.name}</Link>
                      ) : (
                        item.name
                      )}
                    </h2>
                    <p>
                      {item.available
                        ? "1 produk"
                        : "Tidak tersedia — tidak dihitung dalam total"}
                    </p>
                    <button
                      className="text-link"
                      onClick={() => remove(item.id)}
                      aria-label={`Hapus ${item.name}`}
                    >
                      Hapus
                    </button>
                  </div>
                  <span>
                    {item.price !== null ? formatIdr(item.price) : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <button className="text-link" onClick={cart.clear}>
              Kosongkan keranjang
            </button>
          </div>
          <aside className="cart-summary" aria-labelledby="summary-title">
            <h2 id="summary-title">Ringkasan produk</h2>
            {data.pricing ? (
              <>
                <dl>
                  <div>
                    <dt>Subtotal produk tersedia</dt>
                    <dd>{formatIdr(data.pricing.originalSubtotal)}</dd>
                  </div>
                  {data.pricing.promotionDiscount > 0 && (
                    <div>
                      <dt>Potongan bundle</dt>
                      <dd>−{formatIdr(data.pricing.promotionDiscount)}</dd>
                    </div>
                  )}
                  {data.pricing.promotionSurcharge > 0 && (
                    <div>
                      <dt>Penyesuaian harga bundle</dt>
                      <dd>+{formatIdr(data.pricing.promotionSurcharge)}</dd>
                    </div>
                  )}
                  <div className="cart-total">
                    <dt>Total produk</dt>
                    <dd>{formatIdr(data.pricing.merchandiseTotal)}</dd>
                  </div>
                </dl>
                {data.pricing.bundles.map((bundle, i) => (
                  <p className="small-note" key={i}>
                    {bundle.count} bundle × {bundle.quantity} produk diterapkan
                    ({formatIdr(bundle.price)} per bundle).
                  </p>
                ))}
              </>
            ) : (
              <p>Tidak ada produk tersedia untuk dihitung.</p>
            )}
            <p className="small-note">
              Belum termasuk ongkos kirim.
            </p>
            {data.items.every(item => item.available) && data.pricing ? <Link className="primary-action purchase-action" href="/checkout">Lanjut ke checkout</Link> : <p>Hapus produk yang tidak tersedia sebelum checkout.</p>}
            <Link className="text-link" href="/products">
              Lanjut melihat produk
            </Link>
          </aside>
        </div>
      )}
    </>
  );
}
