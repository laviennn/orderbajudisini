import { unstable_cache } from "next/cache";
import { sitemapCount } from "@/server/repositories/catalog";
import { absoluteUrl } from "@/lib/seo";
export const dynamic = "force-dynamic";
const count = unstable_cache(sitemapCount, ["sitemap-count"], {
  revalidate: 300,
  tags: ["storefront", "sitemap"],
});
export async function GET() {
  try {
    const pages = Math.max(1, Math.ceil((await count()) / 1000));
    if (pages > 50000) throw new Error("Sitemap index capacity exceeded");
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: pages }, (_, i) => `<sitemap><loc>${absoluteUrl(`/sitemaps/${i}`)}</loc></sitemap>`).join("")}</sitemapindex>`,
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
