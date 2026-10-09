import Image from "next/image";
import { socialLinks } from "@/lib/social-settings";
import Link from "next/link";
import { storeForShell } from "@/server/services/storefront";
import { CartAccess, Drawer } from "@/features/storefront/Interactions";
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
          <div className="mobile-menu">
            <Drawer label="Menu" title="Navigasi">
              <nav className="mobile-nav" aria-label="Navigasi seluler">
                {navigation}
              </nav>
            </Drawer>
          </div>
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
                width={120}
                height={48}
                style={{ objectFit: "contain", maxWidth: "30vw" }}
              />
            ) : (
              store.name
            )}
          </Link>
          <nav className="desktop-nav" aria-label="Navigasi utama">
            {navigation}
          </nav>
          <CartAccess />
        </div>
      </header>
      {children}
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
            <a href={`mailto:${store.details.supportEmail}`}>
              {store.details.supportEmail}
            </a>
          )}
          {store.details?.whatsappNumber && (
            <p>
              <a href={`tel:+${store.details.whatsappNumber}`}>
                +{store.details.whatsappNumber}
              </a>
            </p>
          )}
          <nav aria-label="Media sosial">
            {socialLinks(store.details?.socialLinks).map(([label, url]) => (
              <a key={label} href={url} rel="noopener noreferrer">
                {label}
              </a>
            ))}
          </nav>
        </div>
        <nav aria-label="Navigasi footer">
          <Link className="text-link" href="/products">
            Semua produk
          </Link>
          <Link className="text-link" href="/admin/login">
            Akses staf
          </Link>
        </nav>
      </footer>
    </div>
  );
}
