import { test, expect } from "@playwright/test";

test.describe("Checkout Flow", () => {
  test("processes happy path checkout", async ({ page }) => {
    page.on("console", msg => console.log("BROWSER:", msg.text()));
    page.on("response", async response => {
      if (response.url().includes("/api/checkout")) {
        console.log("API RESPONSE:", response.status(), await response.text());
      }
    });
    
    // 1. Setup cart via localStorage
    await page.goto("/");
    await page.evaluate(() => {
      // Need a valid active product ID, but we can't reliably guess one.
      // E2E seeds the DB before running tests. Let's just go to /products and click the first product
      // Or since `storefront.spec.ts` assumes the database has products, I can navigate to /products and click the first product link.
    });
    await page.goto("/products");
    await page.locator('.product-grid a').first().click();
    await page.waitForURL(/\/products\/.+/);
    
    await page.getByRole("button", { name: "Tambah ke keranjang" }).click();
    await expect(page.getByRole("link", { name: "Lihat keranjang" })).toBeVisible();

    // 2. Go to checkout
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    // 3. Fill customer details
    await page.getByLabel("Nama Lengkap").fill("Test User");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel(/WhatsApp/).fill("081234567890");
    await page.getByLabel("Alamat Lengkap").fill("Jalan Test No. 123");
    await page.getByLabel("Provinsi").fill("Jawa Barat");
    await page.getByLabel("Kota / Kabupaten").fill("Bandung");
    await page.getByLabel("Kecamatan").fill("Cicendo");
    await page.getByLabel("Kode Pos").fill("40171");

    // 4. Request shipping quotes
    await page.getByRole("button", { name: "Pilih Pengiriman" }).click();
    
    // 5. Select shipping and Place Order
    await expect(page.getByRole("heading", { name: "Pilih Layanan Pengiriman" })).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole("heading", { name: "Pilih Layanan Pengiriman" })).toBeVisible();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Buat Pesanan" }).click();

    // 6. Order Confirmation
    await page.waitForURL(/\/order\/.+/);
    await expect(page.getByRole("heading", { name: "Pesanan Diterima" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Status Pembayaran" })).toBeVisible();
    await expect(page.getByText(/Menunggu Pembayaran/i)).toBeVisible();
  });

  test("prevents checkout without products", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Keranjang kosong" })).toBeVisible();
  });
});
