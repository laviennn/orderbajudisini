import { z } from "zod";
export const slugInput = z
  .string()
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const textFilter = z.string().trim().max(80).catch("").default("");
export const catalogInput = z.object({
  q: textFilter,
  category: z
    .union([slugInput, z.literal("")])
    .catch("")
    .default(""),
  size: textFilter,
  condition: textFilter,
  availability: z
    .enum(["active", "sold", "reserved", "all"])
    .catch("active")
    .default("active"),
  sort: z
    .enum(["newest", "price-asc", "price-desc"])
    .catch("newest")
    .default("newest"),
  min: z.coerce
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .optional()
    .catch(undefined),
  max: z.coerce
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
});
export type CatalogFilter = z.infer<typeof catalogInput>;
export function parseCatalog(
  input: Record<string, string | string[] | undefined>,
) {
  return catalogInput.parse(
    Object.fromEntries(
      Object.entries(input).filter(
        ([, v]) => typeof v === "string" && v !== "",
      ),
    ),
  );
}
export function catalogUrl(
  path: string,
  filters: CatalogFilter,
  changes: Partial<CatalogFilter> = {},
) {
  const values = { ...filters, ...changes };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (
      value === undefined ||
      value === "" ||
      (key === "page" && value === 1) ||
      (key === "sort" && value === "newest") ||
      (key === "availability" && value === "active") ||
      (key === "category" && path.startsWith("/category/"))
    )
      continue;
    params.set(key, String(value));
  }
  return path + (params.size ? `?${params}` : "");
}
export const availabilityLabel = {
  active: "Tersedia",
  sold: "Terjual",
  reserved: "Sedang dipesan",
  draft: "Tidak tersedia",
  archived: "Tidak tersedia",
} as const;
export type PublicImage = {
  sources?: { url: string; width: number }[];
  url: string;
  alt: string;
  width: number;
  height: number;
  defect: boolean;
};
