import "server-only";
import sharp from "sharp";
import { AppError } from "@/lib/errors";
import { getStorage } from "@/server/storage/r2";
import { assertObjectKey } from "@/server/storage/policy";
export async function validateSiteImage(key: string) {
  assertObjectKey(key, "site-media");
  const storage = getStorage();
  const metadata = await storage.inspectObject("site-media", key);
  if (
    metadata.bytes < 1 ||
    metadata.bytes > 10 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(metadata.mime)
  )
    throw new AppError("VALIDATION_ERROR");
  const bytes = await storage.readSiteMedia(key, 10 * 1024 * 1024);
  try {
    if (bytes.length !== metadata.bytes) throw new Error();
    const image = sharp(bytes, {
      limitInputPixels: 24000000,
      failOn: "warning",
    });
    const info = await image.metadata();
    if (
      !info.width ||
      !info.height ||
      !info.format ||
      !["png", "jpeg", "webp"].includes(info.format) ||
      (info.pages ?? 1) !== 1 ||
      `image/${info.format}` !== metadata.mime
    )
      throw new Error();
    // Decode actual pixels; valid headers alone do not prove a complete image.
    await image.raw().toBuffer();
  } catch {
    throw new AppError("VALIDATION_ERROR", {
      image: ["Gunakan gambar JPG, PNG, atau WebP yang valid."],
    });
  }
  return storage.publicMediaUrl(key);
}
