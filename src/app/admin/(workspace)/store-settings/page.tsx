import { getAdminStoreSettings } from "@/server/services/settings";
import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import { getStorage } from "@/server/storage/r2";
import { StoreEditor } from "@/features/admin/StoreEditor";
export default async function StorePage() {
  const actor = await requirePermission("settings.read");
  const row = await getAdminStoreSettings();
  return (
    <main id="main-content">
      <h1>Pengaturan toko</h1>
      <StoreEditor
        initial={
          row ?? {
            storeName: "",
            description: null,
            footerText: null,
            whatsappNumber: null,
            supportEmail: null,
            displayAddress: null,
            logoObjectKey: null,
            faviconObjectKey: null,
            reservationMinutes: null,
            shippingOrigin: null,
          }
        }
        logoUrl={
          row?.logoObjectKey
            ? getStorage().publicMediaUrl(row.logoObjectKey)
            : null
        }
        faviconUrl={
          row?.faviconObjectKey
            ? getStorage().publicMediaUrl(row.faviconObjectKey)
            : null
        }
        editable={hasPermission(actor, "settings.manage")}
      />
    </main>
  );
}
