import { expect, it } from "vitest";
import { catalogUrl, parseCatalog } from "@/lib/catalog";
import { jsonLd } from "@/lib/seo";
import { parseCartStorage } from "@/features/cart/store";
it("normalizes malicious/malformed filters and keeps meaningful URL state", () => {
  const f = parseCatalog({
    page: "-2",
    sort: "DROP TABLE",
    category: "../admin",
    q: ["a", "b"],
    min: "-1",
  });
  expect(f).toMatchObject({
    page: 1,
    sort: "newest",
    category: "",
    q: "",
    min: undefined,
  });
  expect(catalogUrl("/products", { ...f, size: "L", page: 2 })).toBe(
    "/products?size=L&page=2",
  );
});
it("persists only unique valid IDs in insertion order and ignores prices", () => {
  const a = "abcdefab-0000-4000-8000-000000000001";
  const b = "00000000-0000-4000-8000-000000000002";
  expect(
    parseCartStorage(
      JSON.stringify([b, a.toUpperCase(), a, b, { price: 1 }, "bad"]),
    ),
  ).toEqual([b, a]);
  expect(parseCartStorage("bad json")).toEqual([]);
});
it("escapes structured-data script termination", () =>
  expect(jsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain(
    "<",
  ));
