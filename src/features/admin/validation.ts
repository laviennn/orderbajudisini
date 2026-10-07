import { z } from "zod";
import { slugInput } from "@/lib/catalog";
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
export const measurementInput = z
  .object({
    key: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{0,49}$/),
    label: z.string().trim().min(1).max(80),
    value: z.coerce
      .number()
      .positive()
      .max(999999.99)
      .refine((n) => Number.isInteger(Math.round(n * 1000000) / 10000)),
    unit: z.string().trim().min(1).max(12),
  })
  .strict();
export const productEditorInput = z
  .object({
    id: z.uuid().optional(),
    updatedAt: z.iso.datetime().optional(),
    confirmSlugChange: z.boolean().default(false),
    name: z.string().trim().min(1).max(200),
    sku: z.string().trim().min(1).max(80),
    slug: slugInput,
    categoryId: z.uuid(),
    brand: optionalText(100),
    description: z.string().trim().min(1).max(10000),
    shortDescription: optionalText(500),
    price: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    compareAtPrice: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .nullable(),
    sizeLabel: optionalText(60),
    conditionGrade: optionalText(80),
    conditionNotes: z.string().trim().min(1).max(5000),
    defectNotes: optionalText(5000),
    quantity: z.number().int().min(0).max(10000),
    weightGrams: z.number().int().positive().max(100000).nullable(),
    promotionEligible: z.boolean(),
    seoTitle: optionalText(1000),
    seoDescription: optionalText(3000),
    measurements: z
      .array(measurementInput)
      .max(30)
      .refine((rows) => new Set(rows.map((r) => r.key)).size === rows.length),
  })
  .strict();
export const categoryEditorInput = z
  .object({
    id: z.uuid().optional(),
    updatedAt: z.iso.datetime().optional(),
    confirmSlugChange: z.boolean().default(false),
    name: z.string().trim().min(1).max(100),
    slug: slugInput,
    description: optionalText(5000),
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(10000),
    seoTitle: optionalText(1000),
    seoDescription: optionalText(3000),
  })
  .strict();
export function initialSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160)
    .replace(/-$/, "");
}
