import { test, expect } from "@playwright/test";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
test("owner manages SEO, site media, banners, store and social footer end-to-end", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(120000);
  const origin = "http://127.0.0.1:3100";
  const denied = await request.post("/api/admin/seo", {
    headers: { Origin: origin },
    data: {},
  });
  expect(denied.status()).toBe(401);
  await context.route(
    "https://*.r2.cloudflarestorage.com/**",
    async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "PUT",
            "Access-Control-Allow-Headers": "content-type",
          },
        });
        return;
      }
      const key = url.hostname.startsWith("test-public.")
        ? `test-public${url.pathname}`
        : url.pathname.slice(1);
      expect(key).toMatch(/^test-public\/site-media\//);
      const response = await request.put(
        `http://127.0.0.1:3101/${encodeURIComponent(key)}`,
        {
          data: req.postDataBuffer()!,
          headers: { "Content-Type": req.headers()["content-type"]! },
        },
      );
      await route.fulfill({
        status: response.status(),
        headers: { "Access-Control-Allow-Origin": origin },
      });
    },
  );
  await context.route("https://media.example.invalid/**", async (route) => {
    const response = await request.get(
      `http://127.0.0.1:3101/${encodeURIComponent(`test-public${new URL(route.request().url()).pathname}`)}`,
    );
    await route.fulfill({ response });
  });
  await page.goto("/admin/login");
  await page.getByLabel("Email staf").fill("owner-browser@test.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("TEST owner browser passphrase");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/seo");
  await page.getByLabel("Judul situs", { exact: true }).fill("TEST SEO Store");
  await page.getByLabel("Template judul").fill("%s · TEST SEO");
  await page
    .getByLabel("Deskripsi default")
    .fill("TEST configured description");
  await page.getByLabel("Judul beranda").fill("TEST Home SEO");
  await page.getByRole("button", { name: "Tambah halaman" }).click();
  await page
    .getByLabel("URL halaman", { exact: true })
    .fill("/products/test-kemeja-2");
  await page.getByLabel("Judul", { exact: true }).fill("TEST Product SEO");
  await page.getByLabel("Jangan indeks halaman ini").check();
  await page.getByRole("button", { name: "Simpan SEO" }).click();
  await expect(page.getByRole("status")).toContainText("disimpan");
  await page.goto("/products/test-kemeja-2");
  await expect(page).toHaveTitle("TEST Product SEO");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "TEST Product SEO",
  );
  const sitemap = await request.get("/sitemaps/0");
  expect(await sitemap.text()).not.toContain("/products/test-kemeja-2<");
  await page.goto("/admin/store-settings");
  await page
    .getByLabel("Nama toko", { exact: true })
    .fill("TEST Batch B Store");
  await page
    .getByLabel("Deskripsi", { exact: true })
    .fill("TEST store description");
  await page.getByLabel("Telepon/WhatsApp (62…)").fill("6281234567890");
  await page.getByLabel("Teks footer").fill("TEST configured footer");
  await page.getByLabel("Email dukungan").fill("support@test.invalid");
  const png = await sharp({
    create: { width: 128, height: 128, channels: 3, background: "#ddd" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Logo toko", { exact: true })
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Gambar siap.", { exact: false })).toBeVisible();
  await page
    .getByLabel("Favicon (gambar persegi PNG/WebP)")
    .setInputFiles({ name: "favicon.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Gambar siap.", { exact: false })).toHaveCount(2);
  await page.getByRole("button", { name: "Simpan toko" }).click();
  await expect(
    page.getByText("Pengaturan toko disimpan.", { exact: true }),
  ).toBeVisible();
  await page.goto("/admin/social-media");
  await page.getByLabel("Instagram").fill("https://www.instagram.com/test");
  await page.getByLabel("WhatsApp").fill("6281234567890");
  await page.getByRole("button", { name: "Simpan media sosial" }).click();
  await expect(page.getByRole("status")).toContainText("disimpan");
  await page.goto("/admin/banners");
  await page.getByLabel("Nama internal").fill("TEST Batch B Banner");
  await page.getByLabel("Judul", { exact: true }).fill("TEST Banner headline");
  await page
    .getByLabel("Gambar desktop")
    .setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Gambar siap.", { exact: false })).toBeVisible();
  await page
    .getByLabel("Gambar mobile")
    .setInputFiles({ name: "mobile.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Gambar siap.", { exact: false })).toHaveCount(2);
  await page.getByLabel("Aktif", { exact: true }).check();
  await page.getByRole("button", { name: "Simpan banner" }).click();
  await expect(
    page.getByText("Banner disimpan.", { exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveTitle("TEST Home SEO");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    /site-media/,
  );
  await expect(
    page.getByRole("heading", { name: "TEST Banner headline" }),
  ).toBeVisible();
  await expect(
    page.getByText("TEST configured footer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Instagram", exact: true }),
  ).toHaveAttribute("href", "https://www.instagram.com/test");
  await expect(
    page.getByRole("link", { name: "WhatsApp", exact: true }),
  ).toHaveAttribute("href", "https://wa.me/6281234567890");
  await page.goto("/admin/banners");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Aktif", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Simpan banner" }).click();
  await expect(
    page.getByText("Banner disimpan.", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Hapus", exact: true }).click();
  await expect(
    page.getByText("Belum ada banner.", { exact: true }),
  ).toBeVisible();
  for (const route of [
    "/admin/seo",
    "/admin/banners",
    "/admin/store-settings",
    "/admin/social-media",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `test-results/batch-b-${route.split("/").at(-1)}.png`,
      fullPage: true,
    });
  }
});
