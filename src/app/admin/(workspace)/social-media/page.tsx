import { getAdminStoreSettings } from "@/server/services/settings";
import { requirePagePermission } from "@/app/admin/page-auth";
import { hasPermission } from "@/server/auth/policy";
import { SocialEditor } from "@/features/admin/SocialEditor";
export default async function SocialPage() {
  const actor = await requirePagePermission("settings.read");
  const row = await getAdminStoreSettings();
  return (
    <main id="main-content">
      <h1>Media sosial</h1>
      <SocialEditor
        initial={row?.socialLinks ?? null}
        editable={hasPermission(actor, "settings.manage")}
      />
    </main>
  );
}
