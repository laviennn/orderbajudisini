/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useCart } from "@/features/cart/store";
import { trackCommerce, type CommerceEvent } from "@/lib/analytics";
import type { PublicImage } from "@/lib/catalog";
import { formatIdr } from "@/lib/domain/money";
import { availabilityLabel } from "@/lib/catalog";
import type { CatalogProduct } from "@/server/repositories/catalog";

export function Drawer({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    const timer = setTimeout(() => {
      const dialog = dialogRef.current;
      if (dialog && dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = "";
      setIsOpen(false);
      triggerRef.current?.focus();
    }, 320);
    return () => clearTimeout(timer);
  }, []);

  const handleOpen = useCallback(() => {
    if (isOpen) {
      handleClose();
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) {
      dialog.showModal();
    }
    document.body.style.overflow = "hidden";
    setIsOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    });
  }, [isOpen, handleClose]);

  // Close drawer on browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      handleClose();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.body.style.overflow = "";
    };
  }, [handleClose]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`drawer-trigger ${isOpen ? "is-active" : ""}`}
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label}
      >
        {label === "Menu" ? (
          <svg
            className={`hamburger-icon ${isOpen ? "is-active" : ""}`}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ pointerEvents: "none" }}
          >
            <line className="line-top" x1="3" y1="6" x2="21" y2="6" />
            <line className="line-mid" x1="3" y1="12" x2="21" y2="12" />
            <line className="line-bot" x1="3" y1="18" x2="21" y2="18" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ pointerEvents: "none" }}
          >
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
        )}
      </button>
      <dialog
        ref={dialogRef}
        aria-label={title}
        className={`drawer drawer-modal ${isAnimating ? "is-visible" : ""}`}
        onCancel={(e) => {
          e.preventDefault();
          handleClose();
        }}
      >
        <div
          className="drawer-overlay"
          onClick={handleClose}
          aria-hidden="true"
        />
        <div
          className="drawer-panel drawer-content"
          role="document"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="drawer-header">
            <div className="drawer-title-group">
              <span className="drawer-brand-tag">ORDERBAJUDISINI</span>
              <h2 className="drawer-title">{title}</h2>
            </div>
            <button
              type="button"
              className="drawer-close-btn"
              onClick={handleClose}
              aria-label="Tutup"
              autoFocus
            >
              <span>Tutup</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ pointerEvents: "none" }}
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div
            className="drawer-body"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) {
                handleClose();
              }
            }}
          >
            {children}
          </div>
          <div className="drawer-footer">
            <p className="drawer-footer-text">
              Toko Fashion Muslimah Berbasis Online
            </p>
            <p className="drawer-footer-sub">© OrderBajuDisini. The Label</p>
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
      className="cart-link"
      aria-label={`Keranjang, ${ids.length} produk`}
    >
      <div className="cart-icon-wrapper">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        <span className="cart-badge">{ids.length}</span>
      </div>
    </Link>
  );
}
type ProductSelectionContextType = {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  images: PublicImage[];
  productId: string;
  productName: string;
  available: boolean;
};

const ProductSelectionContext =
  createContext<ProductSelectionContextType | null>(null);

export function ProductSelectionProvider({
  images,
  productId,
  productName,
  available,
  children,
}: {
  images: PublicImage[];
  productId: string;
  productName: string;
  available: boolean;
  children: React.ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <ProductSelectionContext.Provider
      value={{
        activeIndex,
        setActiveIndex,
        images,
        productId,
        productName,
        available,
      }}
    >
      {children}
    </ProductSelectionContext.Provider>
  );
}

export function useProductSelection() {
  return useContext(ProductSelectionContext);
}

export function AddToCart({
  id,
  available: propAvailable,
}: {
  id?: string;
  available?: boolean;
}) {
  const selection = useProductSelection();
  const cart = useCart();

  const isMulti = Boolean(selection && selection.images.length > 1);
  const activeImage = selection
    ? (selection.images[selection.activeIndex] ?? null)
    : null;
  const effectiveId =
    isMulti && activeImage?.id
      ? activeImage.id
      : id || selection?.productId || "";
  const available = selection ? selection.available : Boolean(propAvailable);
  const isDefect = Boolean(activeImage?.defect);

  const exists = Boolean(effectiveId && cart.ids.includes(effectiveId));
  const itemNumber = activeImage
    ? (activeImage.sortOrder ?? selection?.activeIndex ?? 0) + 1
    : 1;
  const totalCount = selection ? selection.images.length : 1;

  // Total items from this set currently in the cart
  const setInCartCount = selection
    ? selection.images.filter((img) => img.id && cart.ids.includes(img.id))
        .length
    : exists
      ? 1
      : 0;

  // Remaining available images in set that are not yet in cart
  const remainingImages = selection
    ? selection.images.filter(
        (img) => !img.defect && img.id && !cart.ids.includes(img.id),
      )
    : [];

  const handleAddCurrent = () => {
    if (
      !effectiveId ||
      !available ||
      !cart.ready ||
      exists ||
      isDefect ||
      cart.ids.length >= 100
    )
      return;
    cart.add(effectiveId);
    trackCommerce("add_to_cart", [effectiveId]);
  };

  const handleAddAll = () => {
    if (!available || !cart.ready || remainingImages.length === 0) return;
    const idsToAdd = remainingImages.map((img) => img.id!).filter(Boolean);
    if (idsToAdd.length === 0) return;
    cart.addMultiple(idsToAdd);
    trackCommerce("add_to_cart", idsToAdd);
  };

  return (
    <div className="pdp-action-container">
      {isMulti && (
        <div className="pdp-selection-status-card">
          <div className="pdp-selection-status-row">
            <span className="pdp-selection-current-label">
              Baju Terpilih:{" "}
              <strong>
                Foto #{itemNumber} dari {totalCount}
              </strong>
            </span>
            {setInCartCount > 0 && (
              <span className="pdp-selection-in-cart-counter">
                {setInCartCount} dari {totalCount} sudah di keranjang
              </span>
            )}
          </div>
          {exists ? (
            <div className="pdp-item-cart-alert in-cart">
              <span className="pdp-item-cart-dot" />
              <span>Baju #{itemNumber} ini sudah ada di keranjang Anda.</span>
            </div>
          ) : (
            <p className="pdp-selection-hint">
              Klik foto lain di slider untuk memilih & memesan baju lainnya dari
              set ini.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className={`primary-action purchase-action pdp-purchase-btn ${exists ? "in-cart" : ""}`}
        disabled={
          !available ||
          !cart.ready ||
          exists ||
          isDefect ||
          cart.ids.length >= 100
        }
        onClick={handleAddCurrent}
      >
        {!available ? (
          "Tidak Tersedia (Stok Habis)"
        ) : isDefect ? (
          "Foto Detail Cacat (Bukan unit terpisah)"
        ) : exists ? (
          <>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>
              {isMulti
                ? `Baju #${itemNumber} Sudah di Keranjang`
                : "Sudah Ada di Keranjang"}
            </span>
          </>
        ) : (
          <>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span>
              {isMulti
                ? `Tambah Baju #${itemNumber} ke Keranjang`
                : "Tambah ke Keranjang"}
            </span>
          </>
        )}
      </button>

      {/* Button to add all remaining in set if > 1 remaining */}
      {isMulti && remainingImages.length > 1 && !exists && (
        <button
          type="button"
          className="pdp-add-all-btn"
          disabled={
            !available ||
            !cart.ready ||
            cart.ids.length + remainingImages.length > 100
          }
          onClick={handleAddAll}
        >
          <span>
            + Tambah Semua Baju Tersisa ({remainingImages.length} pcs)
          </span>
        </button>
      )}

      {/* Link to Cart when current or any in set is added */}
      {(exists || setInCartCount > 0) && (
        <Link className="pdp-view-cart-btn" href="/cart">
          <span>Lanjut ke Keranjang Belanja ({cart.ids.length})</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </Link>
      )}

      <div className="pdp-action-guarantee">
        <span className="pdp-stock-indicator">
          <span className="pdp-stock-dot" />
          {available ? "Item Siap Dikirim (1 unit unik)" : "Stok habis"}
        </span>
        <span className="pdp-guarantee-note">
          Checkout instan tanpa perlu registrasi akun.
        </span>
      </div>

      {!cart.persistent && (
        <p role="status" className="small-note">
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
  const selection = useProductSelection();
  const cart = useCart();

  const [localIndex, setLocalIndex] = useState(0);
  const index = selection ? selection.activeIndex : localIndex;
  const setIndex = useCallback(
    (newIndex: number) => {
      if (selection) {
        selection.setActiveIndex(newIndex);
      } else {
        setLocalIndex(newIndex);
      }
    },
    [selection],
  );

  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeImage = images[index] ?? null;
  const activeItemId =
    images.length > 1 && activeImage?.id
      ? activeImage.id
      : (selection?.productId ?? "");
  const isCurrentInCart = Boolean(
    activeItemId && cart.ids.includes(activeItemId),
  );

  const handleSelectImage = useCallback(
    (newIndex: number) => {
      setIndex(newIndex);
      setZoomLevel(1);
      setPan({ x: 0, y: 0 });
      // Scroll active thumbnail to center of slider track
      const thumbEl = thumbRefs.current[newIndex];
      if (thumbEl) {
        thumbEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    },
    [setIndex],
  );

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(3, Number((prev + 0.5).toFixed(1))));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(1, Number((prev - 0.5).toFixed(1)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const handleToggleZoom = () => {
    if (zoomLevel > 1) {
      handleResetZoom();
    } else {
      setZoomLevel(2);
    }
  };

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    const prevIdx = index > 0 ? index - 1 : images.length - 1;
    handleSelectImage(prevIdx);
  }, [images.length, index, handleSelectImage]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    const nextIdx = index < images.length - 1 ? index + 1 : 0;
    handleSelectImage(nextIdx);
  }, [images.length, index, handleSelectImage]);

  const scrollSlider = (direction: "left" | "right") => {
    if (!sliderRef.current) return;
    sliderRef.current.scrollBy({
      left: direction === "left" ? -180 : 180,
      behavior: "smooth",
    });
  };

  // Dragging handlers for main photo
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const maxPan = (zoomLevel - 1) * 180;
    setPan({
      x: Math.max(-maxPan, Math.min(maxPan, dragStartRef.current.panX + dx)),
      y: Math.max(-maxPan, Math.min(maxPan, dragStartRef.current.panY + dy)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      if (zoomLevel > 1) {
        setIsDragging(true);
        dragStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          panX: pan.x,
          panY: pan.y,
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (zoomLevel > 1 && isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      const maxPan = (zoomLevel - 1) * 180;
      setPan({
        x: Math.max(-maxPan, Math.min(maxPan, dragStartRef.current.panX + dx)),
        y: Math.max(-maxPan, Math.min(maxPan, dragStartRef.current.panY + dy)),
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(false);
      return;
    }
    // Detect swipe on mobile when not zoomed
    if (e.changedTouches.length === 1 && images.length > 1) {
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && dt < 450) {
        if (dx < 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    }
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, handlePrev, handleNext]);

  return (
    <div className="gallery gallery-container">
      {/* 1. Main Photo Viewport */}
      <div className="gallery-main gallery-viewport" aria-live="polite">
        {/* Photo Counter */}
        {images.length > 1 && (
          <span className="gallery-counter-pill">
            {index + 1} / {images.length}
          </span>
        )}

        {/* In-Cart Status Badge on Main Photo Preview */}
        {isCurrentInCart && (
          <div className="gallery-in-cart-pill" role="status">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Sudah di Keranjang</span>
          </div>
        )}

        {/* Defect Alert Badge */}
        {activeImage?.defect && (
          <span className="gallery-defect-badge">
            ⚠️ Detail Kondisi / Cacat
          </span>
        )}

        {/* Zoom Controls Bar */}
        {activeImage && (
          <div
            className="gallery-zoom-toolbar"
            role="toolbar"
            aria-label="Kontrol pembesar foto"
          >
            <button
              type="button"
              className="gallery-zoom-btn"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              aria-label="Zoom out foto"
              title="Perkecil (-)"
            >
              −
            </button>
            <button
              type="button"
              className="gallery-zoom-label"
              onClick={handleResetZoom}
              title="Klik untuk reset zoom (100%)"
              aria-label={`Skala zoom ${Math.round(zoomLevel * 100)}%, klik untuk reset`}
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              className="gallery-zoom-btn"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 3}
              aria-label="Zoom in foto"
              title="Perbesar (+)"
            >
              +
            </button>
            <button
              type="button"
              className="gallery-expand-btn"
              onClick={() => {
                setLightboxZoom(1);
                setLightboxOpen(true);
              }}
              aria-label="Buka foto resolusi penuh di layar penuh"
              title="Layar Penuh"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* Main Photo Navigation Arrows */}
        {images.length > 1 && zoomLevel <= 1 && (
          <>
            <button
              type="button"
              className="gallery-nav-arrow prev"
              onClick={handlePrev}
              aria-label="Foto sebelumnya"
            >
              ‹
            </button>
            <button
              type="button"
              className="gallery-nav-arrow next"
              onClick={handleNext}
              aria-label="Foto berikutnya"
            >
              ›
            </button>
          </>
        )}

        {/* Zoom Hint Banner when zoomed */}
        {zoomLevel > 1 && (
          <div className="gallery-drag-hint" aria-hidden="true">
            Tahan & geser untuk melihat detail serat kain
          </div>
        )}

        {/* Zoomable Surface */}
        <div
          className={`gallery-zoom-surface ${zoomLevel > 1 ? "is-zoomed" : ""} ${isDragging ? "is-dragging" : ""}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleToggleZoom}
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoomLevel})`,
            transition: isDragging
              ? "none"
              : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
            cursor:
              zoomLevel > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
          }}
        >
          <ProductPhoto
            key={activeImage?.url ?? "none"}
            image={activeImage}
            priority
            sizes="(max-width: 767px) 100vw, 55vw"
          />
        </div>
      </div>

      {/* 2. Interactive Horizontal Thumbnail Slider under Main Photo */}
      {images.length > 1 && (
        <div
          className="gallery-slider-wrapper"
          aria-label={`Daftar foto ${name}`}
        >
          <button
            type="button"
            className="gallery-slider-arrow left"
            onClick={() => scrollSlider("left")}
            aria-label="Geser thumbnail ke kiri"
          >
            ‹
          </button>
          <div
            className="gallery-slider-track"
            ref={sliderRef}
            role="tablist"
            aria-label="Thumbnail foto produk"
          >
            {images.map((image, i) => {
              const thumbId =
                images.length > 1 && image.id
                  ? image.id
                  : (selection?.productId ?? "");
              const isThumbInCart = Boolean(
                thumbId && cart.ids.includes(thumbId),
              );
              return (
                <button
                  key={image.url}
                  ref={(el) => {
                    thumbRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  className={`gallery-slider-thumb ${i === index ? "active" : ""} ${isThumbInCart ? "in-cart" : ""}`}
                  aria-label={`Lihat foto ${i + 1}${isThumbInCart ? ", sudah di keranjang" : ""}${image.defect ? ", detail cacat" : ""}`}
                  onClick={() => handleSelectImage(i)}
                >
                  <ProductPhoto image={image} sizes="76px" />
                  {isThumbInCart && (
                    <span
                      className="gallery-thumb-cart-badge"
                      title="Baju ini sudah ada di keranjang"
                      aria-hidden="true"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                  {image.defect && (
                    <span
                      className="gallery-thumb-defect-dot"
                      title="Detail cacat"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="gallery-slider-arrow right"
            onClick={() => scrollSlider("right")}
            aria-label="Geser thumbnail ke kanan"
          >
            ›
          </button>
        </div>
      )}

      {/* 3. Fullscreen Lightbox Modal */}
      {lightboxOpen && activeImage && (
        <div
          className="zoom-lightbox-backdrop"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Tampilan foto resolusi penuh"
        >
          <div
            className="zoom-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-top-bar">
              <span className="lightbox-counter">
                {index + 1} / {images.length}{" "}
                {activeImage.defect ? "• Detail Kondisi" : ""}
              </span>
              <div className="lightbox-zoom-bar">
                <button
                  type="button"
                  className="lightbox-ctrl-btn"
                  onClick={() =>
                    setLightboxZoom((z) =>
                      Math.max(1, Number((z - 0.5).toFixed(1))),
                    )
                  }
                  disabled={lightboxZoom <= 1}
                  aria-label="Zoom out"
                >
                  −
                </button>
                <span className="lightbox-zoom-text">
                  {Math.round(lightboxZoom * 100)}%
                </span>
                <button
                  type="button"
                  className="lightbox-ctrl-btn"
                  onClick={() =>
                    setLightboxZoom((z) =>
                      Math.min(3, Number((z + 0.5).toFixed(1))),
                    )
                  }
                  disabled={lightboxZoom >= 3}
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  className="lightbox-ctrl-btn"
                  onClick={() => {
                    setLightboxZoom(1);
                  }}
                  title="Reset Zoom"
                >
                  ↺
                </button>
              </div>
              <button
                type="button"
                className="zoom-close-btn"
                onClick={() => setLightboxOpen(false)}
                aria-label="Tutup pembesar"
              >
                ✕
              </button>
            </div>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox-nav-btn prev"
                  onClick={handlePrev}
                  aria-label="Foto sebelumnya"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="lightbox-nav-btn next"
                  onClick={handleNext}
                  aria-label="Foto berikutnya"
                >
                  ›
                </button>
              </>
            )}

            <div className="lightbox-img-stage">
              <img
                src={activeImage.url}
                alt={activeImage.alt || name}
                className="zoom-lightbox-img"
                style={{
                  transform: `scale(${lightboxZoom})`,
                  transition: "transform 0.2s ease",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function InteractiveProductCard({
  product,
  priority = false,
}: {
  product: CatalogProduct;
  priority?: boolean;
}) {
  const allImages =
    product.previewImages && product.previewImages.length > 0
      ? product.previewImages
      : product.image
        ? [product.image]
        : [];
  const [activeIdx, setActiveIdx] = useState(0);
  const productHref = `/products/${product.slug}`;
  const isAvailable = product.status === "active";

  const handleTrack = () => {
    trackCommerce("select_item", [product.id]);
  };

  return (
    <article className="boutique-card">
      <div className="boutique-card-media">
        <Link
          href={productHref}
          className="boutique-photo-link"
          aria-label={product.name}
          onClick={handleTrack}
        >
          <div className="boutique-photo-frame">
            <ProductPhoto
              image={allImages[activeIdx] ?? product.image}
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </div>
        </Link>

        {!isAvailable && (
          <div className="boutique-media-status-badge">
            {availabilityLabel[product.status]}
          </div>
        )}

        {allImages.length > 1 && (
          <div className="boutique-media-indicators" aria-hidden="true">
            <span className="boutique-photo-count-pill">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>{allImages.length}</span>
            </span>

            <div className="boutique-desktop-thumbs" aria-label="Pilihan foto">
              {allImages.slice(0, 4).map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  className={`boutique-mini-thumb ${i === activeIdx ? "active" : ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveIdx(i);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  aria-label={`Foto ${i + 1}`}
                >
                  <img src={img.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="boutique-card-info">
        <div className="boutique-card-header">
          {product.categoryName && (
            <p className="boutique-product-category">{product.categoryName}</p>
          )}

          <h3 className="boutique-product-title">
            <Link
              href={productHref}
              className="boutique-title-link"
              onClick={handleTrack}
            >
              {product.name}
            </Link>
          </h3>
        </div>

        <div className="boutique-card-footer">
          <div className="boutique-price-rating">
            <div className="boutique-pricing-anchor">
              <div className="boutique-anchor-price-row">
                <span className="boutique-anchor-price">Rp 100.000</span>
                <span className="boutique-anchor-unit">/ 3 pcs</span>
              </div>
              <span className="boutique-unit-price">
                Satuan: {formatIdr(product.price || 50000)}
              </span>
            </div>
            <span className="boutique-shipping-pill">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              <span>Bebas Ongkir min. 2</span>
            </span>
          </div>

          {!isAvailable ? (
            <div className="boutique-status-pill">
              {availabilityLabel[product.status]}
            </div>
          ) : (
            <Link
              href={productHref}
              className="boutique-btn-action"
              onClick={handleTrack}
            >
              <span>Lihat Detail</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function MultiPhotoSelector({
  product,
}: {
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    status: string;
  };
  images?: PublicImage[];
}) {
  return <AddToCart id={product.id} available={product.status === "active"} />;
}

export function ProductVariantSelector({
  product,
  available,
}: {
  product: {
    id: string;
    sizeLabel?: string | null;
    status: string;
  };
  available: boolean;
}) {
  return <AddToCart id={product.id} available={available} />;
}

export function WhatsAppFloatingButton({
  whatsappNumber,
  storeName,
}: {
  whatsappNumber: string | null;
  storeName: string;
}) {
  if (!whatsappNumber) return null;
  const cleanNumber = whatsappNumber.replace(/\D/g, "");
  const message = `Halo ${storeName}, saya tertarik untuk memesan produk di toko online Anda.`;
  const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;

  return (
    <aside
      aria-label="Kontak bantuan pesan"
      className="floating-whatsapp-container"
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-whatsapp-pill"
        aria-label="Chat admin toko"
      >
        <span className="whatsapp-icon-circle">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#FFFFFF"
            aria-hidden="true"
          >
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
        </span>
        <span className="whatsapp-pill-text">WhatsApp us</span>
      </a>
    </aside>
  );
}

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="scroll-to-top-btn"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Kembali ke atas"
      title="Kembali ke atas"
    >
      ▲
    </button>
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
