import { requirePagePermission } from "@/app/admin/page-auth";
import { hasPermission } from "@/server/auth/policy";
import { adminCategories } from "@/server/services/admin-products";
import { CategoryEditor } from "@/features/admin/CategoryEditor";
export default async function Categories() {
  const actor = await requirePagePermission("categories.read");
  const categories = await adminCategories();
  return (
    <main id="main-content">
      <h1>Kategori</h1>
      <CategoryEditor
        writable={hasPermission(actor, "categories.write")}
        categories={categories.map((c) => ({
          ...c,
          updatedAt: c.updatedAt.toISOString(),
        }))}
      />
    </main>
  );
}
