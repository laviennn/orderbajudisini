import { z } from "zod";
export const publicPagePath = z
  .string()
  .regex(/^\/(?:products(?:\/[a-z0-9-]+)?|category\/[a-z0-9-]+)?$/);
export const pageSeoInput = z
  .object({
    path: publicPagePath,
    title: z.string().trim().max(300).nullable(),
    description: z.string().trim().max(2000).nullable(),
    image: z
      .url()
      .refine((v) => v.startsWith("https://"))
      .nullable(),
    canonical: publicPagePath.nullable(),
    noindex: z.boolean(),
  })
  .strict();
export type PageSeo = z.infer<typeof pageSeoInput>;
export const seoInput = z
  .object({
    siteTitle: z.string().trim().min(1).max(300),
    titleTemplate: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .refine((s) => s.includes("%s")),
    defaultDescription: z.string().trim().max(2000),
    defaultOgImage: z
      .url()
      .refine((v) => v.startsWith("https://"))
      .nullable(),
    homepageTitle: z.string().trim().max(300).nullable(),
    homepageDescription: z.string().trim().max(2000).nullable(),
    indexingEnabled: z.boolean().default(true),
    pages: z
      .array(pageSeoInput)
      .max(500)
      .default([])
      .refine((rows) => new Set(rows.map((r) => r.path)).size === rows.length),
  })
  .strict();
export type SeoConfiguration = z.infer<typeof seoInput>;
export function includeInSitemap(
  path: string,
  seo: Pick<SeoConfiguration, "indexingEnabled" | "pages"> | null,
) {
  const page = seo?.pages.find((p) => p.path === path);
  return (
    seo?.indexingEnabled !== false &&
    !page?.noindex &&
    (!page?.canonical || page.canonical === path)
  );
}
