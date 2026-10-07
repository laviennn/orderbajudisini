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
          <Link href="/admin">Ringkasan</Link>
          {hasPermission(actor, "products.read") && (
            <Link href="/admin/products">Produk</Link>
          )}
          {hasPermission(actor, "categories.read") && (
            <Link href="/admin/categories">Kategori</Link>
          )}
        </nav>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
