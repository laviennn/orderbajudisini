import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import { AppError } from "@/lib/errors";
import { logoutAction } from "../actions";
export default async function AdminWorkspace({
  children,
}: {
  children: React.ReactNode;
}) {
  let actor;
  try {
    actor = await requirePermission("admin.access");
  } catch (error) {
    if (
      error instanceof AppError &&
      ["UNAUTHENTICATED", "NOT_CONFIGURED"].includes(error.code)
    )
      redirect("/admin/login");
    throw error;
  }
  return (
    <div className="admin-frame">
      <header className="admin-header">
        <Link className="wordmark" href="/admin">
          OrderBajuDisini <span>Admin</span>
        </Link>
        <Link className="text-link" href="/">
          Lihat toko
        </Link>
        <form action={logoutAction}>
          <button className="text-link">Keluar</button>
        </form>
      </header>
      <div className="admin-workspace">
        <nav className="admin-nav" aria-label="Menu administrasi">
          <Link href="/admin">Dashboard</Link>
          
          <div className="nav-group">Katalog</div>
          {hasPermission(actor, "products.read") && (
            <Link href="/admin/products">Produk</Link>
          )}
          {hasPermission(actor, "categories.read") && (
            <Link href="/admin/categories">Kategori</Link>
          )}
          {hasPermission(actor, "reviews.read") && (
            <Link href="/admin/reviews">Ulasan</Link>
          )}
          
          <div className="nav-group">Pesanan</div>
          {hasPermission(actor, "orders.read") && (
            <Link href="/admin/orders">Semua Pesanan</Link>
          )}
          {hasPermission(actor, "payments.verify") && (
            <Link href="/admin/payments">Verifikasi Pembayaran</Link>
          )}
          {hasPermission(actor, "shipments.read") && (
            <Link href="/admin/shipments">Pengiriman</Link>
          )}
          
          <div className="nav-group">Konten & Pemasaran</div>
          {hasPermission(actor, "content.read") && (
            <Link href="/admin/banners">Banner</Link>
          )}
          {hasPermission(actor, "promotions.read") && (
            <Link href="/admin/promotions">Promosi</Link>
          )}
          {hasPermission(actor, "media.read") && (
            <Link href="/admin/media">Media Library</Link>
          )}
          {hasPermission(actor, "seo.read") && (
            <Link href="/admin/seo">Pengaturan SEO</Link>
          )}
          
          <div className="nav-group">Pengaturan</div>
          {hasPermission(actor, "settings.read") && (
            <>
              <Link href="/admin/payment-methods">Metode Pembayaran</Link>
              <Link href="/admin/store-settings">Pengaturan Toko</Link>
              <Link href="/admin/social-media">Media Sosial</Link>
            </>
          )}
          {hasPermission(actor, "operators.read") && (
            <Link href="/admin/operators">Operator</Link>
          )}
          {hasPermission(actor, "audit.read") && (
            <Link href="/admin/audit-logs">Log Audit</Link>
          )}
        </nav>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
