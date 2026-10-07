import type { Metadata } from "next";
import { site } from "./site";
export function pageMetadata(
  title: string,
  description: string | null,
  path: string,
  image?: string | null,
  noindex = false,
): Metadata {
  return {
    title: { absolute: title },
    description: description || undefined,
    alternates: { canonical: path },
    robots: { index: !noindex, follow: true },
    openGraph: {
      title,
      description: description || undefined,
      url: path,
      type: "website",
      ...(image && /^https:\/\//.test(image) ? { images: [image] } : {}),
    },
  };
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
export const absoluteUrl = (path: string) => new URL(path, site.origin).href;
