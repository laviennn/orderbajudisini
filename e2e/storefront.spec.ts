import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const id = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const browserErrors = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://media.example.invalid/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#e8e4d9"/><path d="M200 130L110 190 60 340 150 370 180 310 180 650 420 650 420 310 450 370 540 340 490 190 400 130 340 170 260 170Z" fill="#999f90"/><path d="M300 180V650" stroke="#e8e4d9" stroke-width="6"/><text x="300" y="740" text-anchor="middle" font-size="24" fill="#444">TEST IMAGE — NOT STORE CONTENT</text></svg>',
    }),
  );
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});
for (const [width, height] of [
  [360, 800],
  [390, 844],
  [768, 1024],
  [1366, 768],
  [1440, 900],
] as const) {
  test(`catalog, detail and cart layout at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const path of [
      "/products",
      "/category/test-kemeja",
      "/products/test-kemeja-1",
      "/products/test-kemeja-31",
      "/cart",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      if (path === "/cart") {
        await page.evaluate(
          (values) =>
            localStorage.setItem(
              "orderbajudisini.cart.v1",
              JSON.stringify(values),
            ),
          [id(1), id(2), id(3), id(4), id(5), id(6)],
        );
        await page.reload();
        await expect(page.locator(".cart-total dd")).toContainText("200.000");
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `test-results/storefront-${width}-${path.replaceAll("/", "-")}.png`,
        fullPage: true,
      });
    }
  });
}
test("search, filters, pagination, public reviews, sold state and promotion visibility", async ({
  page,
}) => {
  await page.goto("/products?q=TEST-1&sort=price-asc");
  await expect(
    page.getByRole("heading", { name: "TEST Kemeja 01", exact: true }),
  ).toBeVisible();
  await page.goto("/products?size=L");
  await expect(page.locator(".product-grid li")).toHaveCount(15);
  await page.goto("/products");
  await expect(page.locator(".product-grid li")).toHaveCount(24);
  await page.getByRole("link", { name: "Berikutnya", exact: true }).click();
  await expect(page.locator(".product-grid li")).toHaveCount(6);
  await expect(page.locator(".product-grid")).not.toContainText(
    /bundle|promo|eligible/i,
  );
  await page.goto("/products/test-kemeja-1");
  await expect(
    page.getByText("TEST Ulasan disetujui.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("TEST Ulasan rahasia.")).toHaveCount(0);
  await expect(page.locator(".product-info")).not.toContainText(
    /bundle|promo|eligible/i,
  );
  await expect(page.getByText("56 cm")).toBeVisible();
  const thumbnail = page.getByRole("button", {
    name: "Lihat foto 2, detail cacat",
  });
  await thumbnail.focus();
  await page.keyboard.press("Enter");
  await expect(thumbnail).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".gallery-main img")).toHaveAttribute(
    "alt",
    "TEST detail noda lengan",
  );
  await expect(
    page.getByText("TEST — noda kecil di bagian lengan."),
  ).toBeVisible();
  await page.goto("/products/test-kemeja-31");
  await expect(
    page.getByRole("button", { name: "Tidak tersedia", exact: true }),
  ).toBeDisabled();
  await page.goto("/products/test-kemeja-32");
  await expect(
    page.getByRole("heading", { name: "Halaman tidak ditemukan." }),
  ).toBeVisible();
  await page.goto("/category/absent");
  await expect(
    page.getByRole("heading", { name: "Halaman tidak ditemukan." }),
  ).toBeVisible();
});
test("cart add, persistence, removal, unavailable entries and server pricing", async ({
  page,
}) => {
  await page.goto("/products/test-kemeja-1");
  await page.getByRole("button", { name: "Tambah ke keranjang" }).click();
  await page
    .getByRole("link", { name: "Lihat keranjang", exact: true })
    .click();
  await expect(page.locator(".cart-lines li")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".cart-lines li")).toHaveCount(1);
  await page.getByRole("button", { name: "Hapus TEST Kemeja 01" }).click();
  await expect(
    page.getByRole("heading", { name: "Keranjang masih kosong." }),
  ).toBeVisible();
  for (const [items, total] of [
    [[1], "45.000"],
    [[1, 2, 3], "100.000"],
    [[10, 11, 12], "135.000"],
    [[1, 10, 2, 11, 3], "190.000"],
    [[1, 2, 3, 4, 5, 6], "200.000"],
    [[1, 31, 32], "45.000"],
  ] as [number[], string][]) {
    await page.evaluate(
      (values) =>
        localStorage.setItem("orderbajudisini.cart.v1", JSON.stringify(values)),
      items.map(id),
    );
    await page.reload();
    await expect(page.locator(".cart-total dd")).toContainText(total);
    await expect(page.locator(".cart-lines li")).toHaveCount(items.length);
    await expect(
      page.getByRole("button", { name: /Lanjut ke checkout/ }),
    ).toBeDisabled();
  }
  await expect(
    page.getByText("Produk tidak tersedia", { exact: true }),
  ).toBeVisible();
});
test("mobile drawer keyboard focus and filter submission", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/products");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Navigasi", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Cari, filter & urutkan" }).click();
  const dialog = page.getByRole("dialog", { name: "Filter produk" });
  await dialog.getByLabel("Cari produk").fill("TEST-1");
  await dialog.getByRole("button", { name: "Terapkan" }).click();
  await expect(page).toHaveURL(/q=TEST-1/);
  await expect(page.locator(".product-grid li")).toHaveCount(11);
});
test("SEO, public sitemap and bounded cart input", async ({
  page,
  request,
}) => {
  await page.goto("/products/test-kemeja-1");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://orderbajudisini.com/products/test-kemeja-1",
  );
  const structured = await page
    .locator('script[type="application/ld+json"]')
    .first()
    .textContent();
  expect(JSON.parse(structured || "{}")).toMatchObject({
    "@type": "Product",
    aggregateRating: { reviewCount: 1 },
  });
  const sitemap = await request.get("/sitemaps/0");
  const xml = await sitemap.text();
  expect(xml).toContain("test-kemeja-1</loc>");
  expect(xml).not.toContain("test-kemeja-32</loc>");
  expect(xml).not.toContain("test-kemeja-31</loc>");
  const response = await request.post("/api/cart/price", {
    data: { ids: [id(1)], price: 1 },
  });
  expect(response.status()).toBe(400);
});

test("pricing failure retries safely and search/media empty states remain useful", async ({
  page,
}) => {
  await page.goto("/products?q=missing-test-name");
  await expect(
    page.getByRole("heading", { name: "Belum ada produk yang sesuai." }),
  ).toBeVisible();
  await page.goto("/products/test-kemeja-2");
  await expect(
    page.getByRole("heading", { name: "Belum ada ulasan." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tambah ke keranjang" }).click();
  await page.route("**/api/cart/price", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await page.goto("/cart");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Harga belum dapat diperiksa",
  );
  await expect(page.locator(".cart-total")).toHaveCount(0);
  await page.unroute("**/api/cart/price");
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.locator(".cart-total dd")).toContainText("45.000");
  await page.route("https://media.example.invalid/**", (route) =>
    route.abort(),
  );
  await page.goto("/products/test-kemeja-1");
  await expect(page.locator(".gallery-main")).toContainText(
    "Foto belum tersedia",
  );
});
