import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import {
  adminCategories,
  adminProduct,
} from "@/server/services/admin-products";
import { AppError } from "@/lib/errors";
import { ProductEditor } from "./ProductEditor";
export async function ProductScreen({ id }: { id?: string }) {
  const actor = await requirePermission(
    id ? "products.read" : "products.create",
  );
  let product = null;
  if (id) {
    try {
      product = await adminProduct(id);
    } catch (error) {
      if (
        error instanceof AppError &&
        ["NOT_FOUND", "VALIDATION_ERROR"].includes(error.code)
      )
        notFound();
      throw error;
    }
  }
  const categories = hasPermission(actor, "categories.read")
    ? await adminCategories()
    : [];
  return (
    <main id="main-content">
      <ProductEditor
        key={product?.id ?? "new"}
        product={product}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          active: c.active,
        }))}
        rights={{
          edit: hasPermission(
            actor,
            id ? "products.update" : "products.create",
          ),
          media: hasPermission(actor, "media.write"),
          publish: hasPermission(actor, "products.publish"),
          archive: hasPermission(actor, "products.archive"),
          promotion: hasPermission(actor, "promotions.manage"),
        }}
      />
    </main>
  );
}
