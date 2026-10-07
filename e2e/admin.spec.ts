import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";

test("owner manages catalog, real optimized media, metadata and publication", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(120_000);
  const origin = "http://127.0.0.1:3100";
  const denied = await request.post("/api/admin/products", {
    headers: { Origin: origin },
    data: {},
  });
  expect(denied.status()).toBe(401);
  await context.route(
    "https://*.r2.cloudflarestorage.com/**",
    async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      expect(url.hostname).toContain("a".repeat(32));
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
      const key = url.hostname.startsWith("test-private.")
        ? `test-private${url.pathname}`
        : url.pathname.slice(1);
      expect(key).toMatch(/^test-private\/product-source\//);
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
    const key = `test-public${new URL(route.request().url()).pathname}`;
    const response = await request.get(
      `http://127.0.0.1:3101/${encodeURIComponent(key)}`,
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
  await page.goto("/admin/products");
  await expect(
    page.getByRole("heading", { name: "Produk", exact: true }),
  ).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/admin-list-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto("/admin/products/new");
  await page
    .getByLabel("Nama produk", { exact: true })
    .fill("TEST Browser Jacket");
  await page.getByLabel("SKU", { exact: true }).fill("TEST-BROWSER-JACKET");
  await page
    .getByRole("combobox", { name: "Kategori", exact: true })
    .selectOption({ label: "TEST Kemeja" });
  await page
    .getByLabel("Deskripsi", { exact: true })
    .fill("TEST jacket description for isolated browser checks.");
  await page.getByLabel("Harga (Rp)", { exact: true }).fill("65000");
  await page.getByLabel("Label ukuran", { exact: true }).fill("L");
  await page.getByRole("button", { name: "Tambah pengukuran" }).click();
  await page
    .getByLabel("Nama pengukuran 1", { exact: true })
    .fill("Lebar dada");
  await page.getByLabel("Nilai 1", { exact: true }).fill("56.5");
  await page.getByLabel("Grade kondisi", { exact: true }).fill("TEST Good");
  await page
    .getByLabel("Catatan kondisi", { exact: true })
    .fill("TEST fading on collar");
  await page
    .getByLabel("Catatan cacat (jika ada)", { exact: true })
    .fill("TEST sleeve mark");
  await page.getByLabel("Eligible untuk harga bundle").check();
  await page.getByLabel("Judul SEO", { exact: true }).fill("TEST Jacket SEO");
  await page
    .getByLabel("Meta description", { exact: true })
    .fill("TEST jacket SEO description");
  await page.screenshot({
    path: "test-results/admin-create.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Simpan draft", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[\w-]+\/edit$/);
  const editUrl = page.url();
  const id = editUrl.split("/").at(-2)!;
  await expect(
    page.getByText("Status: draft.", { exact: false }),
  ).toBeVisible();
  const publicPage = await context.newPage();
  await publicPage.goto("/products/test-browser-jacket");
  await expect(
    publicPage.getByRole("heading", { name: "Halaman tidak ditemukan." }),
  ).toBeVisible();
  await expect(
    publicPage.locator('meta[name="robots"][content*="noindex"]').first(),
  ).toBeAttached();
  const source = await sharp({
    create: { width: 1600, height: 2000, channels: 3, background: "#a85642" },
  })
    .jpeg()
    .toBuffer();
  await page.locator('input[type="file"]').setInputFiles([
    { name: "front.jpg", mimeType: "image/jpeg", buffer: source },
    { name: "back.jpg", mimeType: "image/jpeg", buffer: source },
  ]);
  await page
    .getByLabel("Alt text unggahan", { exact: true })
    .nth(0)
    .fill("TEST jacket front");
  await page
    .getByLabel("Alt text unggahan", { exact: true })
    .nth(1)
    .fill("TEST jacket back");
  await page.getByRole("button", { name: "Unggah foto terpilih" }).click();
  await expect(page.getByText("Foto tersimpan.", { exact: true })).toHaveCount(
    2,
    { timeout: 30_000 },
  );
  await expect(page.locator(".media-editor-list > li")).toHaveCount(2);
  await page.getByRole("button", { name: "Naikkan foto 2" }).click();
  await expect(page.getByLabel("Alt text foto 1", { exact: true })).toHaveValue(
    "TEST jacket back",
  );
  await page.goto(`/admin/products/${id}/preview`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(
    page.getByRole("heading", { name: "TEST Browser Jacket", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-preview.png",
    fullPage: true,
  });
  await page.goto(editUrl);
  await page.getByRole("button", { name: "Publikasikan", exact: true }).click();
  await expect(
    page.getByText("Status: active.", { exact: false }),
  ).toBeVisible();
  await publicPage.goto("/products/test-browser-jacket");
  await expect(publicPage).toHaveTitle(/TEST Jacket SEO/);
  await expect(publicPage.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "TEST jacket SEO description",
  );
  await expect(
    publicPage
      .getByRole("img", { name: "TEST jacket back", exact: true })
      .first(),
  ).toBeVisible();
  await expect(publicPage.getByText(/65\.000/).first()).toBeVisible();
  await publicPage.goto("/products?q=TEST+Browser+Jacket");
  await expect(
    publicPage.getByRole("link", { name: /TEST Browser Jacket/ }).first(),
  ).toBeVisible();
  await page.getByLabel("Harga (Rp)", { exact: true }).fill("72000");
  await page
    .getByLabel("Judul SEO", { exact: true })
    .fill("TEST Revised Jacket SEO");
  await page
    .getByRole("button", { name: "Simpan perubahan", exact: true })
    .click();
  await expect(
    page.getByText("Produk tersimpan.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Naikkan foto 2" }).click();
  await expect(page.getByLabel("Alt text foto 1", { exact: true })).toHaveValue(
    "TEST jacket front",
  );
  await publicPage.goto("/products/test-browser-jacket");
  await expect(publicPage).toHaveTitle(/TEST Revised Jacket SEO/);
  await expect(publicPage.getByText(/72\.000/).first()).toBeVisible();
  await expect(
    publicPage
      .getByRole("img", { name: "TEST jacket front", exact: true })
      .first(),
  ).toBeVisible();
  await publicPage.screenshot({
    path: "test-results/admin-storefront-result.png",
    fullPage: true,
  });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `test-results/admin-editor-${width}.png`,
      fullPage: true,
    });
  }
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Arsipkan produk", exact: true })
    .click();
  await expect(
    page.getByText("Status: archived.", { exact: false }),
  ).toBeVisible();
  await publicPage.goto("/products/test-browser-jacket");
  await expect(
    publicPage.getByRole("heading", { name: "Halaman tidak ditemukan." }),
  ).toBeVisible();
  await expect(
    publicPage.locator('meta[name="robots"][content*="noindex"]').first(),
  ).toBeAttached();
  await publicPage.goto("/products?q=TEST+Browser+Jacket");
  await expect(
    publicPage.getByRole("link", { name: /TEST Browser Jacket/ }),
  ).toHaveCount(0);
});

test("order operator cannot bypass catalog permissions through HTTP", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email staf").fill("order-browser@test.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("TEST order browser passphrase");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Produk", exact: true }),
  ).toHaveCount(0);
  const id = "00000000-0000-4000-8000-000000000001";
  for (const [path, data] of [
    ["/api/admin/products", {}],
    ["/api/admin/categories", {}],
    [
      `/api/admin/products/${id}/status`,
      { action: "publish", updatedAt: new Date().toISOString() },
    ],
    [
      `/api/admin/products/${id}/media/authorize`,
      { mime: "image/png", bytes: 100, altText: "TEST", isDefectImage: false },
    ],
    [`/api/admin/products/${id}/media`, { action: "remove", imageId: id }],
  ] as const) {
    const response = await page.request.post(path, {
      headers: { Origin: "http://127.0.0.1:3100" },
      data,
    });
    expect(response.status(), path).toBe(403);
  }
});

test("owner creates and edits a category through the application", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email staf").fill("owner-browser@test.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("TEST owner browser passphrase");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/categories");
  await page
    .getByLabel("Nama kategori", { exact: true })
    .fill("TEST Browser Category");
  await page
    .getByLabel("Slug kategori", { exact: true })
    .fill("test-browser-category");
  await page
    .getByLabel("Deskripsi kategori", { exact: true })
    .fill("TEST isolated category");
  await page.getByLabel("Urutan kategori", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Simpan kategori", exact: true })
    .click();
  await expect(
    page.getByText("Kategori tersimpan.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "TEST Browser Category", exact: true })
    .click();
  await page
    .getByLabel("Judul SEO kategori", { exact: true })
    .fill("TEST category title");
  await expect(page.getByLabel("Slug kategori", { exact: true })).toHaveValue(
    "test-browser-category",
  );
  await page.getByLabel("Kategori aktif", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Simpan kategori", exact: true })
    .click();
  await expect(
    page.getByText("Kategori tersimpan.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "TEST Browser Category", exact: true })
    .click();
  await expect(
    page.getByLabel("Judul SEO kategori", { exact: true }),
  ).toHaveValue("TEST category title");
  await expect(
    page.getByLabel("Kategori aktif", { exact: true }),
  ).not.toBeChecked();
  await page.screenshot({
    path: "test-results/admin-category.png",
    fullPage: true,
  });
});
