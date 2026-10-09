import type { Metadata } from "next";
import type { SeoConfiguration } from "./seo-settings";
import { site } from "./site";
export function pageMetadata(
  title: string,
  description: string | null,
  path: string,
  image?: string | null,
  noindex = false,
  seo?: SeoConfiguration | null,
): Metadata {
  const override = seo?.pages.find((p) => p.path === path);
  title = override?.title || title;
  description =
    override?.description || description || seo?.defaultDescription || null;
  image = override?.image || image || seo?.defaultOgImage;
  const canonical = override?.canonical || path;
  noindex =
    noindex || seo?.indexingEnabled === false || Boolean(override?.noindex);
  return {
    twitter: {
      card: "summary_large_image",
      title,
      description: description || undefined,
      ...(image ? { images: [image] } : {}),
    },
    title: { absolute: title },
    description: description || undefined,
    alternates: { canonical },
    robots: { index: !noindex, follow: true },
    openGraph: {
      title,
      description: description || undefined,
      url: canonical,
      type: "website",
      ...(image && /^https:\/\//.test(image) ? { images: [image] } : {}),
    },
  };
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
export const absoluteUrl = (path: string) => new URL(path, site.origin).href;

export function seoTitle(
  title: string,
  name: string,
  seo?: SeoConfiguration | null,
) {
  return (seo?.titleTemplate || `%s | ${name}`).replaceAll("%s", title);
}
