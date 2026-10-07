"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/features/cart/store";
import { trackCommerce, type CommerceEvent } from "@/lib/analytics";
import type { PublicImage } from "@/lib/catalog";
export function Drawer({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="text-link drawer-trigger"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
      >
        {label}
      </button>
      <dialog
        ref={ref}
        aria-label={title}
        className="drawer"
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
      >
        <div className="drawer-content">
          <div className="section-heading">
            <h2>{title}</h2>
            <button
              className="text-link"
              onClick={() => ref.current?.close()}
              autoFocus
            >
              Tutup
            </button>
          </div>
          <div
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) ref.current?.close();
            }}
          >
            {children}
          </div>
        </div>
      </dialog>
    </>
  );
}
export function CartAccess() {
  const { ids } = useCart();
  return (
    <Link
      href="/cart"
      className="text-link"
      aria-label={`Keranjang, ${ids.length} produk`}
    >
      Keranjang <span className="cart-count">{ids.length}</span>
    </Link>
  );
}
export function AddToCart({
  id,
  available,
}: {
  id: string;
  available: boolean;
}) {
  const cart = useCart();
  const exists = cart.ids.includes(id);
  return (
    <div>
      <button
        className="primary-action purchase-action"
        disabled={!available || !cart.ready || exists || cart.ids.length >= 100}
        onClick={() => {
          cart.add(id);
          trackCommerce("add_to_cart", [id]);
        }}
      >
        {!available
          ? "Tidak tersedia"
          : exists
            ? "Sudah di keranjang"
            : "Tambah ke keranjang"}
      </button>
      <p aria-live="polite" className="small-note">
        {exists ? (
          <Link className="text-link" href="/cart">
            Lihat keranjang
          </Link>
        ) : (
          "Produk belum dipesan saat ditambahkan ke keranjang."
        )}
      </p>
      {!cart.persistent && (
        <p role="status">
          Penyimpanan browser tidak tersedia. Keranjang hanya tersimpan selama
          halaman ini terbuka.
        </p>
      )}
    </div>
  );
}
export function ProductPhoto({
  image,
  priority = false,
  sizes = "(max-width: 767px) 45vw, 25vw",
}: {
  image: PublicImage | null;
  priority?: boolean;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!image || failed)
    return <div className="image-missing">Foto belum tersedia</div>;
  // R2 media is already sized at source. Avoid a second transformation proxy.
  return (
    <picture>
      <source
        srcSet={(image.sources?.length
          ? image.sources
          : [{ url: image.url, width: image.width }]
        )
          .map((source) => `${source.url} ${source.width}w`)
          .join(", ")}
        sizes={sizes}
      />
      <img
        src={image.url}
        ref={(node) => {
          // A cached/network failure may precede hydration, before React attaches onError.
          if (node?.complete && node.naturalWidth === 0) setFailed(true);
        }}
        alt={image.alt || "Foto produk"}
        width={image.width}
        height={image.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </picture>
  );
}
export function Gallery({
  images,
  name,
}: {
  images: PublicImage[];
  name: string;
}) {
  const [index, setIndex] = useState(0);
  return (
    <div className="gallery">
      <div className="gallery-main" aria-live="polite">
        <ProductPhoto
          key={images[index]?.url ?? "none"}
          image={images[index] ?? null}
          priority
          sizes="(max-width: 767px) 100vw, 55vw"
        />
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbnails" aria-label={`Foto ${name}`}>
          {images.map((image, i) => (
            <button
              key={image.url}
              aria-label={`Lihat foto ${i + 1}${image.defect ? ", detail cacat" : ""}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            >
              <ProductPhoto image={image} sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function AnalyticsView({
  event,
  ids,
}: {
  event: CommerceEvent;
  ids: string[];
}) {
  const value = ids.join(",");
  const previous = useRef("");
  useEffect(() => {
    const key = `${event}:${value}`;
    if (previous.current !== key) {
      previous.current = key;
      trackCommerce(event, value ? value.split(",") : []);
    }
  }, [event, value]);
  return null;
}
export function ProductLink({
  id,
  href,
  children,
}: {
  id: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="product-link"
      prefetch={false}
      onClick={() => trackCommerce("select_item", [id])}
    >
      {children}
    </Link>
  );
}
