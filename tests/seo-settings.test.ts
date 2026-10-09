import { expect, it } from "vitest";
import { seoInput, includeInSitemap } from "@/lib/seo-settings";
import { pageMetadata, seoTitle } from "@/lib/seo";
const seo = seoInput.parse({
  siteTitle: "TEST",
  titleTemplate: "%s · TEST",
  defaultDescription: "TEST description",
  defaultOgImage: "https://example.invalid/test.png",
  homepageTitle: null,
  homepageDescription: null,
  pages: [
    {
      path: "/products/test",
      title: "TEST override",
      description: null,
      image: null,
      canonical: "/products/other",
      noindex: false,
    },
  ],
});
it("applies templates, page overrides, canonical and social fallback", () => {
  expect(seoTitle("Product", "Store", seo)).toBe("Product · TEST");
  const result = pageMetadata(
    "Original",
    null,
    "/products/test",
    null,
    false,
    seo,
  );
  expect(result.title).toEqual({ absolute: "TEST override" });
  expect(result.alternates).toEqual({ canonical: "/products/other" });
  expect(result.openGraph).toMatchObject({ images: [seo.defaultOgImage] });
  expect(result.twitter).toMatchObject({ title: "TEST override" });
});
it("excludes noindex and alternate canonicals from sitemap and never overrides private noindex", () => {
  expect(includeInSitemap("/products/test", seo)).toBe(false);
  expect(includeInSitemap("/products", seo)).toBe(true);
  expect(includeInSitemap("/", { ...seo, indexingEnabled: false })).toBe(false);
  expect(
    pageMetadata("Private", null, "/checkout", null, true, seo).robots,
  ).toMatchObject({ index: false });
  expect(
    pageMetadata("Home", null, "/", null, false, {
      ...seo,
      indexingEnabled: false,
    }).robots,
  ).toMatchObject({ index: false });
});
it("rejects private paths, external canonical, unsafe images and duplicate paths", () => {
  for (const patch of [
    { path: "/order/token" },
    { canonical: "https://evil.invalid" },
    { image: "javascript:alert(1)" },
  ])
    expect(
      seoInput.safeParse({ ...seo, pages: [{ ...seo.pages[0], ...patch }] })
        .success,
    ).toBe(false);
  expect(
    seoInput.safeParse({ ...seo, pages: [seo.pages[0], seo.pages[0]] }).success,
  ).toBe(false);
});
