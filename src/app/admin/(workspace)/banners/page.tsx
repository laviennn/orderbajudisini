import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import { listBanners } from "@/server/services/banners";
import { BannerEditor } from "@/features/admin/BannerEditor";
export default async function BannersPage() {
  const actor = await requirePermission("content.read");
  return (
    <main id="main-content">
      <h1>Banner beranda</h1>
      <BannerEditor
        initial={await listBanners()}
        editable={hasPermission(actor, "content.write")}
      />
    </main>
  );
}
