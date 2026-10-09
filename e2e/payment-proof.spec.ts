import { test, expect } from "@playwright/test";
import sharp from "sharp";

test.describe("Payment Proof Integration", () => {
  test("allows user to upload payment proof after checkout", async ({
    page,
    context,
    request,
  }) => {
    const origin = "http://127.0.0.1:3100";
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
        const key = url.hostname.startsWith("test-private.")
          ? `test-private${url.pathname}`
          : url.pathname.slice(1);
        expect(key).toMatch(/^test-private\/payment-proof\//);
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
    // 1. Create an order via checkout
    await page.goto("/products/test-kemeja-24");

    await page.getByRole("button", { name: "Tambah ke keranjang" }).click();
    await expect(
      page.getByRole("link", { name: "Lihat keranjang" }),
    ).toBeVisible();

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
    await expect(
      page.getByRole("heading", { name: "Pilih Layanan Pengiriman" }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Buat Pesanan" }).click();

    await page.waitForURL(/\/order\/.+/);
    await expect(page.getByText(/Menunggu Pembayaran/i)).toBeVisible();

    // 2. Upload payment proof
    const bytes = await sharp({
      create: { width: 80, height: 120, channels: 3, background: "white" },
    })
      .jpeg()
      .toBuffer();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-proof.jpg",
      mimeType: "image/jpeg",
      buffer: bytes,
    });

    // Wait for the UI to recognize it
    await expect(
      page.getByText(/File terpilih:.*test-proof.jpg/),
    ).toBeVisible();

    // Click upload
    await page.getByRole("button", { name: "Unggah Bukti Transfer" }).click();

    // 3. Verify status changed to submitted
    await expect(
      page.getByText(
        /Bukti pembayaran telah diterima dan sedang menunggu verifikasi/i,
      ),
    ).toBeVisible({ timeout: 10000 });

    // Check WhatsApp confirmation button
    const waButton = page.getByRole("button", {
      name: "Konfirmasi via WhatsApp",
    });
    await expect(waButton).toBeVisible();

    // Intercept WhatsApp API request to mock it
    await page.route("**/api/order/*/whatsapp", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://wa.me/6281234567890?text=Mock%20message",
        }),
      });
    });

    // We can't easily assert the actual window.open in playwright if it opens in a new tab
    // Instead, let's just make sure the button exists and is clickable.
    await waButton.click();
  });
});
