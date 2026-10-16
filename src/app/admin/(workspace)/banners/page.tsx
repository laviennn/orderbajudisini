import { requirePagePermission } from "@/app/admin/page-auth";
import { hasPermission } from "@/server/auth/policy";
import { listBanners } from "@/server/services/banners";
import { BannerEditor } from "@/features/admin/BannerEditor";
export default async function BannersPage() {
  const actor = await requirePagePermission("content.read");
  return (
    <main id="main-content">
      <BannerEditor
        initial={await listBanners()}
        editable={hasPermission(actor, "content.write")}
      />
    </main>
  );
}
