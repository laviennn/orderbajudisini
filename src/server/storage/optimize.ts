import "server-only";
import sharp from "sharp";
import { AppError } from "@/lib/errors";
export const variantSizes = {
  thumbnail: 320,
  card: 720,
  detail: 1440,
} as const;
export async function optimizeProductImage(bytes: Buffer, mime: string) {
  try {
    const image = sharp(bytes, {
      limitInputPixels: 24_000_000,
      failOn: "warning",
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    const expected = {
      "image/jpeg": "jpeg",
      "image/png": "png",
      "image/webp": "webp",
    }[mime];
    if (
      !expected ||
      metadata.format !== expected ||
      !metadata.width ||
      !metadata.height ||
      metadata.width < 100 ||
      metadata.height < 100 ||
      (metadata.pages ?? 1) > 1
    )
      throw new AppError("VALIDATION_ERROR");
    const variants = [];
    // Sequential work bounds peak memory; Sharp drops EXIF/GPS by default.
    for (const [variant, width] of Object.entries(variantSizes)) {
      const { data, info } = await image
        .clone()
        .rotate()
        .resize({
          width,
          height: Math.round((width * 4) / 3),
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (data.length > 1_500_000) throw new AppError("VALIDATION_ERROR");
      variants.push({
        variant: variant as keyof typeof variantSizes,
        data,
        width: info.width,
        height: info.height,
        bytes: info.size,
      });
    }
    return variants;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("VALIDATION_ERROR", {
      file: [
        "Gambar tidak valid. Gunakan JPEG, PNG, atau WebP statis, minimal 100px dan maksimal 24 megapiksel.",
      ],
    });
  }
}
