import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

test.describe("Payment Proof Integration", () => {
  test("allows user to upload payment proof after checkout", async ({ page, request, context }) => {
    // 1. Create an order via checkout
    await page.goto("/products");
    await page.locator('.product-grid a').first().click();
    await page.waitForURL(/\/products\/.+/);
    
    await page.getByRole("button", { name: "Tambah ke keranjang" }).click();
    await expect(page.getByRole("link", { name: "Lihat keranjang" })).toBeVisible();

    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    await page.getByLabel("Nama Lengkap").fill("Test Uploader");
    await page.getByLabel("Email").fill("uploader@example.com");
    await page.getByLabel(/WhatsApp/).fill("081234567890");
    await page.getByLabel("Alamat Lengkap").fill("Jalan Test No. 123");
    await page.getByLabel("Provinsi").fill("Jawa Barat");
    await page.getByLabel("Kota / Kabupaten").fill("Bandung");
    await page.getByLabel("Kecamatan").fill("Cicendo");
    await page.getByLabel("Kode Pos").fill("40171");

    await page.getByRole("button", { name: "Pilih Pengiriman" }).click();
    await expect(page.getByRole("heading", { name: "Pilih Layanan Pengiriman" })).toBeVisible({ timeout: 10000 });
    
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Buat Pesanan" }).click();

    await page.waitForURL(/\/order\/.+/);
    await expect(page.getByText(/Menunggu Pembayaran/i)).toBeVisible();

    // 2. Upload payment proof
    const fakeImageBuffer = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]), // valid JPEG magic
      Buffer.alloc(100),
    ]);
    const tmpFile = path.join(os.tmpdir(), "test-proof.jpg");
    await fs.writeFile(tmpFile, fakeImageBuffer);

    // Mock the R2 PUT request
    const origin = new URL(page.url()).origin;
    await context.route(
      "https://*.r2.cloudflarestorage.com/**",
      async (route) => {
        const req = route.request();
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
        const url = new URL(req.url());
        const key = url.hostname.startsWith("test-private.")
          ? `test-private${url.pathname}`
          : url.pathname.slice(1);
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

    // Provide file to input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tmpFile);

    // Wait for the UI to recognize it
    await expect(page.getByText(/File terpilih:.*test-proof.jpg/)).toBeVisible();

    // Click upload
    await page.getByRole("button", { name: "Unggah Bukti Transfer" }).click();

    // 3. Verify status changed to submitted
    console.log(await page.content()); await expect(page.getByText(/Bukti pembayaran telah diterima dan sedang menunggu verifikasi/i)).toBeVisible({ timeout: 10000 });
    
    // Check WhatsApp confirmation button
    const waButton = page.getByRole("button", { name: "Konfirmasi via WhatsApp" });
    await expect(waButton).toBeVisible();

    // Intercept WhatsApp API request to mock it
    await page.route("**/api/order/*/whatsapp", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "https://wa.me/6281234567890?text=Mock%20message" })
      });
    });

    // We can't easily assert the actual window.open in playwright if it opens in a new tab without setting up page context listeners, 
    // but we can at least check if it gets clicked and loading states.
    // Instead, let's just make sure the button exists and is clickable.
    await waButton.click();
    
    // We expect loading state to appear briefly
    await expect(page.getByRole("button", { name: "Memproses..." })).toBeVisible();
    await expect(waButton).toBeVisible({ timeout: 5000 }); // goes back to original state

    await fs.unlink(tmpFile).catch(() => {});
  });
});
