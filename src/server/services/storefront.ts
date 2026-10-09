import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { getDatabase } from "@/server/db";
import { banners, seoSettings, storeSettings } from "@/server/db/schema";
import { databaseOperation } from "@/server/db/operations";
import * as catalog from "@/server/repositories/catalog";
import {
  approvedReviewSummary,
  listApprovedReviews,
} from "@/server/repositories/reviews";
import { getStorage } from "@/server/storage/r2";
import { site } from "@/lib/site";
// Catalog mutations invalidate scoped tags; short TTL also bounds stale browsing data.
const options = { revalidate: 60, tags: ["storefront"] };
const catalogOptions = { revalidate: 60, tags: ["storefront", "catalog"] };
const categoryOptions = {
  revalidate: 60,
  tags: ["storefront", "catalog-categories"],
};
export const readCatalog = unstable_cache(
  catalog.listCatalog,
  ["catalog-v2"],
  catalogOptions,
);
export const readCategories = unstable_cache(
  catalog.listCategories,
  ["categories-v2"],
  categoryOptions,
);
export const readCategory = cache(
  unstable_cache(catalog.getCategory, ["category-v2"], categoryOptions),
);
export const readFacets = unstable_cache(
  catalog.catalogFacets,
  ["facets-v2"],
  catalogOptions,
);
export const readProduct = cache((slug: string) =>
  unstable_cache(() => catalog.getProduct(slug), ["product-v2", slug], {
    revalidate: 60,
    tags: ["storefront", "catalog-products", `product:${slug}`],
  })(),
);
export const readRelated = unstable_cache(
  catalog.relatedProducts,
  ["related-v2"],
  catalogOptions,
);
export const readReviews = unstable_cache(listApprovedReviews, ["reviews-v1"], {
  revalidate: 60,
  tags: ["storefront", "reviews"],
});
export const readReviewSummary = cache(
  unstable_cache(approvedReviewSummary, ["review-summary-v1"], {
    revalidate: 60,
    tags: ["storefront", "reviews"],
  }),
);
export const readStore = cache(
  unstable_cache(
    async () =>
      databaseOperation(async () => {
        const [[store], [seo]] = await Promise.all([
          getDatabase()
            .select({
              storeName: storeSettings.storeName,
              description: storeSettings.description,
              logoObjectKey: storeSettings.logoObjectKey,
              faviconObjectKey: storeSettings.faviconObjectKey,
              footerText: storeSettings.footerText,
              supportEmail: storeSettings.supportEmail,
              whatsappNumber: storeSettings.whatsappNumber,
              displayAddress: storeSettings.displayAddress,
              socialLinks: storeSettings.socialLinks,
            })
            .from(storeSettings)
            .limit(1),
          getDatabase()
            .select({
              siteTitle: seoSettings.siteTitle,
              indexingEnabled: seoSettings.indexingEnabled,
              pages: seoSettings.pages,
              titleTemplate: seoSettings.titleTemplate,
              defaultDescription: seoSettings.defaultDescription,
              defaultOgImage: seoSettings.defaultOgImage,
              homepageTitle: seoSettings.homepageTitle,
              homepageDescription: seoSettings.homepageDescription,
            })
            .from(seoSettings)
            .limit(1),
        ]);
        return {
          name: store?.storeName || site.name,
          seo: seo ?? null,
          details: store
            ? {
                ...store,
                logoUrl: store.logoObjectKey
                  ? getStorage().publicMediaUrl(store.logoObjectKey)
                  : null,
                faviconUrl: store.faviconObjectKey
                  ? getStorage().publicMediaUrl(store.faviconObjectKey)
                  : null,
              }
            : null,
        };
      }),
    ["public-store-v1"],
    options,
  ),
);
export async function storeForShell() {
  try {
    return await readStore();
  } catch {
    console.error({ event: "storefront_configuration_unavailable" });
    return { name: site.name, seo: null, details: null };
  }
}
export function safeContentHref(value: string | null) {
  return value && /^\/(?!\/)[a-z0-9/?=&%#._-]*$/i.test(value) ? value : null;
}
export const readBanner = unstable_cache(
  async () =>
    databaseOperation(async () => {
      const now = new Date();
      const [row] = await getDatabase()
        .select({
          headline: banners.headline,
          body: banners.body,
          imageKey: banners.imageObjectKey,
          mobileKey: banners.mobileImageObjectKey,
          ctaLabel: banners.ctaLabel,
          ctaUrl: banners.ctaUrl,
        })
        .from(banners)
        .where(
          and(
            eq(banners.active, true),
            or(isNull(banners.startsAt), lte(banners.startsAt, now)),
            or(isNull(banners.endsAt), gt(banners.endsAt, now)),
          ),
        )
        .orderBy(asc(banners.sortOrder), asc(banners.id))
        .limit(1);
      if (!row) return null;
      const media = (key: string | null) => {
        if (!key) return null;
        try {
          return getStorage().publicMediaUrl(key);
        } catch {
          return null;
        }
      };
      return {
        headline: row.headline,
        body: row.body,
        image: media(row.imageKey),
        mobileImage: media(row.mobileKey),
        ctaLabel: row.ctaLabel,
        ctaUrl: safeContentHref(row.ctaUrl),
      };
    }),
  ["banner-v1"],
  options,
);
