import { z } from "zod";
import { AppError } from "@/lib/errors";

export const uploadSchema = z
  .object({
    purpose: z.enum(["product", "payment-proof", "product-source"]),
    mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
    bytes: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
  })
  .strict();

export type UploadInput = z.infer<typeof uploadSchema>;
export type StoragePurpose = UploadInput["purpose"];
const extensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export function createObjectKey(input: UploadInput, id: string): string {
  const valid = uploadSchema.safeParse(input);
  if (!valid.success || !z.uuid().safeParse(id).success)
    throw new AppError("VALIDATION_ERROR");
  return `${input.purpose}/${id}.${extensions[input.mime]}`;
}

export function assertObjectKey(key: string, purpose: StoragePurpose) {
  const pattern = new RegExp(
    `^${purpose}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$`,
  );
  if (!pattern.test(key)) throw new AppError("VALIDATION_ERROR");
}
