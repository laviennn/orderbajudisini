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
            {store.name}
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
          <p className="small-note">Pemesanan belum dibuka.</p>
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
