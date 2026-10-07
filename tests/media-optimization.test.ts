import { expect, it } from "vitest";
import sharp from "sharp";
import { optimizeProductImage } from "@/server/storage/optimize";
import { initialSlug } from "@/features/admin/validation";
it("optimizes once, keeps aspect ratio and strips source metadata", async () => {
  const bytes = await sharp({
    create: { width: 1800, height: 2400, channels: 3, background: "#456789" },
  })
    .withMetadata({ exif: { IFD0: { Artist: "TEST metadata" } } })
    .jpeg()
    .toBuffer();
  const variants = await optimizeProductImage(bytes, "image/jpeg");
  expect(variants.map((v) => v.width)).toEqual([320, 720, 1440]);
  for (const variant of variants) {
    const meta = await sharp(variant.data).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.width! / meta.height!).toBeCloseTo(0.75, 2);
  }
});
it("rejects MIME mismatch, unsupported actual formats and tiny images", async () => {
  const png = await sharp({
    create: { width: 50, height: 50, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  await expect(optimizeProductImage(png, "image/png")).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
  await expect(optimizeProductImage(png, "image/jpeg")).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
  await expect(
    optimizeProductImage(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"/>',
      ),
      "image/png",
    ),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
});
it("normalizes initial slugs without changing an existing persisted slug", () => {
  expect(initialSlug("Kemeja Linen — Écru / L")).toBe("kemeja-linen-ecru-l");
});
