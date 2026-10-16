import Image from "next/image";
import { socialLinks } from "@/lib/social-settings";
import { SocialIcon } from "@/features/storefront/SocialIcon";
import Link from "next/link";
import { storeForShell } from "@/server/services/storefront";
import {
  CartAccess,
  Drawer,
  WhatsAppFloatingButton,
  ScrollToTopButton,
} from "@/features/storefront/Interactions";

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = await storeForShell();
  const navigation = (
    <>
      <Link className="text-link" href="/">
        Beranda
      </Link>
      <Link className="text-link" href="/products">
        Shop
      </Link>
      <Link className="text-link" href="/track-order">
        Lacak pesanan
      </Link>
    </>
  );
  return (
    <div className="site-frame">
      <header className="site-header">
        <div className="page-width header-inner">
          <Link
            href="/"
            className="wordmark"
            aria-label={`${store.name}, halaman utama`}
          >
            {store.details?.logoUrl ? (
              <Image
                unoptimized
                src={store.details.logoUrl}
                alt=""
                width={140}
                height={48}
                style={{
                  objectFit: "contain",
                  maxHeight: "42px",
                  width: "auto",
                }}
              />
            ) : (
              <span className="brand-wordmark">
                <span className="brand-monogram">
                  {store.name.charAt(0).toUpperCase()}
                </span>
                <span className="brand-name-group">
                  <span className="brand-title">{store.name}</span>
                  <span className="brand-tagline">THE LABEL</span>
                </span>
              </span>
            )}
          </Link>
          <nav className="desktop-nav" aria-label="Navigasi utama">
            {navigation}
          </nav>
          <div className="header-actions">
            <CartAccess />
            <div className="mobile-menu">
              <Drawer label="Menu" title="Navigasi">
                <nav className="mobile-nav" aria-label="Navigasi seluler">
                  {navigation}
                </nav>
              </Drawer>
            </div>
          </div>
        </div>
      </header>
      {children}
      <WhatsAppFloatingButton
        whatsappNumber={store.details?.whatsappNumber ?? null}
        storeName={store.name}
      />
      <ScrollToTopButton />
      <footer className="page-width site-footer">
        <div>
          <Link className="wordmark" href="/">
            {store.name}
          </Link>
          {store.details?.description && (
            <p className="small-note">{store.details.description}</p>
          )}
          {store.details?.footerText && (
            <p className="small-note">{store.details.footerText}</p>
          )}
          {store.details?.displayAddress && (
            <p>{store.details.displayAddress}</p>
          )}
          {store.details?.supportEmail && (
            <p className="footer-contact-line">
              <a
                href={`mailto:${store.details.supportEmail}`}
                className="footer-contact-link"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span>{store.details.supportEmail}</span>
              </a>
            </p>
          )}
          {store.details?.whatsappNumber && (
            <p className="footer-contact-line">
              <a
                href={`tel:+${store.details.whatsappNumber}`}
                className="footer-contact-link"
              >
                <SocialIcon platform="WhatsApp" size={16} />
                <span>+{store.details.whatsappNumber}</span>
              </a>
            </p>
          )}
          <nav aria-label="Media sosial" className="footer-social-nav">
            {socialLinks(store.details?.socialLinks).map(([label, url]) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className={`footer-social-btn footer-social-${label.toLowerCase()}`}
              >
                <SocialIcon platform={label} size={20} />
                <span className="sr-only">{label}</span>
              </a>
            ))}
          </nav>
        </div>
        <nav aria-label="Navigasi footer">
          <Link className="text-link" href="/products">
            Semua produk
          </Link>
        </nav>
      </footer>
    </div>
  );
}
