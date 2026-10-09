import { Catalog } from "@/features/storefront/Catalog";
import { parseCatalog } from "@/lib/catalog";
import { pageMetadata, seoTitle } from "@/lib/seo";
import { storeForShell } from "@/server/services/storefront";
export const dynamic = "force-dynamic";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ searchParams }: Props) {
  const s = await storeForShell();
  const query = await searchParams;
  return pageMetadata(
    seoTitle("Shop", s.name, s.seo),
    "Lihat produk, ukuran, harga, dan ketersediaan.",
    "/products",
    undefined,
    Object.keys(query).length > 0,
    s.seo,
  );
}
export default async function Products({ searchParams }: Props) {
  return <Catalog filters={parseCatalog(await searchParams)} />;
}
