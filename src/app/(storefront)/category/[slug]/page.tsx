import { notFound } from "next/navigation";
import { Catalog } from "@/features/storefront/Catalog";
import { parseCatalog } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { readCategory, storeForShell } from "@/server/services/storefront";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  const c = await readCategory((await params).slug);
  if (!c) return {};
  const s = await storeForShell();
  return pageMetadata(
    c.seoTitle || `${c.name} | ${s.name}`,
    c.seoDescription || c.description,
    `/category/${c.slug}`,
    undefined,
    Object.keys(await searchParams).length > 0,
  );
}
export default async function Category({ params, searchParams }: Props) {
  const c = await readCategory((await params).slug);
  if (!c) notFound();
  return (
    <Catalog
      path={`/category/${c.slug}`}
      title={c.name}
      description={c.description}
      filters={parseCatalog({ ...(await searchParams), category: c.slug })}
    />
  );
}
