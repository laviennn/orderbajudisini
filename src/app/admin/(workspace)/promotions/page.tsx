import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import { promotionEditorData } from "@/server/services/promotions";
import { PromotionEditor } from "@/features/admin/PromotionEditor";
export default async function Promotions() {
  const actor = await requirePermission("promotions.read");
  const data = await promotionEditorData();
  return (
    <main id="main-content">
      <h1>Promosi bundle</h1>
      <PromotionEditor
        items={data.items.map((p) => ({
          ...p,
          startsAt: p.startsAt?.toISOString() ?? null,
          endsAt: p.endsAt?.toISOString() ?? null,
          updatedAt: p.updatedAt.toISOString(),
        }))}
        categories={data.categories}
        writable={hasPermission(actor, "promotions.manage")}
      />
    </main>
  );
}
