import { getAdminSeoSettings } from "@/server/services/settings";
import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import { SeoEditor } from "@/features/admin/SeoEditor";
export default async function SeoPage() {
  const actor = await requirePermission("seo.read");
  const initial = await getAdminSeoSettings();
  return (
    <main id="main-content">
      <h1>Pengaturan SEO</h1>
      <p>
        Judul sekitar 50–60 karakter dan deskripsi sekitar 150–160 karakter
        membantu keterbacaan. Tampilan hasil pencarian dapat berbeda.
      </p>
      <SeoEditor
        initial={initial}
        editable={hasPermission(actor, "seo.manage")}
      />
    </main>
  );
}
