import { getAdminStoreSettings } from "@/server/services/settings";
import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import { SocialEditor } from "@/features/admin/SocialEditor";
export default async function SocialPage() {
  const actor = await requirePermission("settings.read");
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
