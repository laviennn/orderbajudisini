import { readStore } from "@/server/services/storefront";
import { includeInSitemap } from "@/lib/seo-settings";
import { unstable_cache } from "next/cache";
import { sitemapCategories, sitemapBatch } from "@/server/repositories/catalog";
import { absoluteUrl } from "@/lib/seo";
export const dynamic = "force-dynamic";
const batch = unstable_cache(sitemapBatch, ["sitemap-batch"], {
  revalidate: 300,
  tags: ["storefront", "sitemap"],
});
const categoryBatch = unstable_cache(
  sitemapCategories,
  ["sitemap-categories"],
  { revalidate: 300, tags: ["storefront", "sitemap"] },
);
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const value = (await params).page;
  if (!/^(0|[1-9]\d{0,5})$/.test(value))
    return new Response("Not found", { status: 404 });
  try {
    const page = Number(value);
    const [rows, categories] = await Promise.all([
      batch(page),
      categoryBatch(page),
    ]);
    if (page > 0 && !rows.length && !categories.length)
      return new Response("Not found", { status: 404 });
    const { seo } = await readStore();
    const paths = [
      ...(page === 0 ? ["/", "/products"] : []),
      ...categories.map((c) => `/category/${c.slug}`),
      ...rows.map((p) => `/products/${p.slug}`),
    ].filter((path) => includeInSitemap(path, seo));
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${absoluteUrl(path)}</loc></url>`).join("")}</urlset>`,
      {
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "public, max-age=300",
        },
      },
    );
  } catch {
    return new Response("Sitemap belum tersedia.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
