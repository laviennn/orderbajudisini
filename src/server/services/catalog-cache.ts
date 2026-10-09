import "server-only";
import { revalidateTag } from "next/cache";
// Called by admin HTTP adapters only AFTER successful service commits.
export function invalidateProduct(slug: string, previousSlug?: string) {
  revalidateTag("catalog", { expire: 0 });
  revalidateTag("sitemap", { expire: 0 });
  revalidateTag(`product:${slug}`, { expire: 0 });
  if (previousSlug && previousSlug !== slug)
    revalidateTag(`product:${previousSlug}`, { expire: 0 });
}
export function invalidateCategories() {
  for (const tag of [
    "catalog",
    "catalog-categories",
    "catalog-products",
    "sitemap",
  ])
    revalidateTag(tag, { expire: 0 });
}
// Payment verification/cancellation may affect multiple product reservations.
export function invalidateInventory() {
  for (const tag of ["catalog", "catalog-products", "sitemap"])
    revalidateTag(tag, { expire: 0 });
}
