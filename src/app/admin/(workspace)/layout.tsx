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
          {(
            [
              {
                name: "Katalog",
                links: [
                  ["/admin/products", "Produk", ["products.read"]],
                  ["/admin/categories", "Kategori", ["categories.read"]],
                  ["/admin/reviews", "Ulasan", ["reviews.read"]],
                ],
              },
              {
                name: "Pesanan & pembayaran",
                links: [
                  ["/admin/orders", "Semua pesanan", ["orders.read"]],
                  ["/admin/payments", "Pembayaran", ["payments.read"]],
                  [
                    "/admin/orders?status=processing",
                    "Antrean pengiriman",
                    ["orders.read", "shipments.read"],
                  ],
                ],
              },
              {
                name: "Pemasaran",
                links: [
                  ["/admin/banners", "Banner", ["content.read"]],
                  ["/admin/promotions", "Promosi", ["promotions.read"]],
                  ["/admin/seo", "Pengaturan SEO", ["seo.read"]],
                ],
              },
              {
                name: "Pengaturan & akses",
                links: [
                  [
                    "/admin/payment-methods",
                    "Metode pembayaran",
                    ["settings.read"],
                  ],
                  [
                    "/admin/store-settings",
                    "Pengaturan toko",
                    ["settings.read"],
                  ],
                  ["/admin/social-media", "Media sosial", ["settings.read"]],
                  ["/admin/operators", "Staf dan akses", ["operators.read"]],
                  ["/admin/audit-logs", "Log audit", ["audit.read"]],
                ],
              },
            ] as const
          ).map((group) => {
            const links = group.links.filter(([, , permissions]) =>
              permissions.every((permission) =>
                hasPermission(actor, permission),
              ),
            );
            return links.length ? (
              <div className="admin-nav-group" key={group.name}>
                <div className="nav-group">{group.name}</div>
                {links.map(([href, label]) => (
                  <Link key={String(href)} href={String(href)}>
                    {label}
                  </Link>
                ))}
              </div>
            ) : null;
          })}
        </nav>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
