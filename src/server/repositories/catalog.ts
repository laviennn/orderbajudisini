import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { getDatabase } from "@/server/db";
import {
  products,
  categories,
  productImages,
  productMeasurements,
} from "@/server/db/schema";
import { databaseOperation } from "@/server/db/operations";
import {
  catalogInput,
  slugInput,
  type CatalogFilter,
  type PublicImage,
} from "@/lib/catalog";
import { getStorage } from "@/server/storage/r2";
export const pageSize = 24;
export const publicProductFields = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  price: products.price,
  sizeLabel: products.sizeLabel,
  status: products.status,
};
const imageFields = {
  objectKey: productImages.objectKey,
  altText: productImages.altText,
  width: productImages.width,
  height: productImages.height,
  bytes: productImages.bytes,
  isDefectImage: productImages.isDefectImage,
  variants: sql<
    ImageVariant[] | null
  >`(select json_agg(json_build_object('objectKey', v.object_key, 'width', v.width, 'bytes', v.bytes)) from product_images v where v.group_id = product_images.group_id)`,
};
type ImageVariant = { objectKey: string; width: number; bytes: number };
type ImageRow = {
  variants?: ImageVariant[] | null;
  objectKey: string;
  altText: string;
  width: number;
  height: number;
  bytes: number;
  isDefectImage: boolean;
};
export function publicImage(row: ImageRow | null): PublicImage | null {
  // Delivery bounds apply to both legacy records and ingestion-generated variants.
  if (!row || row.bytes > 1_500_000 || row.width > 2000 || row.height > 2400)
    return null;
  try {
    return {
      url: getStorage().publicMediaUrl(row.objectKey),
      sources: [
        ...new Map(
          (row.variants ?? [])
            .filter((v) => v.bytes <= 1_500_000 && v.width <= 2000)
            .map((v) => [
              v.width,
              { width: v.width, url: getStorage().publicMediaUrl(v.objectKey) },
            ]),
        ).values(),
      ],
      alt: row.altText,
      width: row.width,
      height: row.height,
      defect: row.isDefectImage,
    };
  } catch {
    return null;
  }
}
export const primaryImage = sql<ImageRow | null>`(select json_build_object('objectKey', pi.object_key, 'altText', pi.alt_text, 'width', pi.width, 'height', pi.height, 'bytes', pi.bytes, 'isDefectImage', pi.is_defect_image, 'variants', (select json_agg(json_build_object('objectKey', v.object_key, 'width', v.width, 'bytes', v.bytes)) from product_images v where v.group_id = pi.group_id)) from product_images pi where pi.product_id = products.id and not pi.is_defect_image and pi.bytes <= 1500000 and pi.width <= 2000 and pi.height <= 2400 order by pi.sort_order, case pi.variant when 'card' then 0 when 'detail' then 1 else 2 end, pi.id limit 1)`;
const publicCategory = eq(categories.active, true);
const publicStates = inArray(products.status, ["active", "reserved", "sold"]);
export async function listCatalog(input: CatalogFilter) {
  return databaseOperation(async () => {
    const f = catalogInput.parse(input);
    const search = `%${f.q.replace(/[\\%_]/g, "\\$&")}%`;
    const where = and(
      publicCategory,
      f.availability === "all"
        ? publicStates
        : eq(products.status, f.availability),
      f.category ? eq(categories.slug, f.category) : undefined,
      f.size ? eq(products.sizeLabel, f.size) : undefined,
      f.condition ? eq(products.conditionGrade, f.condition) : undefined,
      f.min !== undefined ? gte(products.price, f.min) : undefined,
      f.max !== undefined ? lte(products.price, f.max) : undefined,
      f.q
        ? or(
            ilike(products.name, search),
            ilike(products.sku, search),
            ilike(products.brand, search),
            ilike(categories.name, search),
          )
        : undefined,
    );
    const sort =
      f.sort === "price-asc"
        ? asc(products.price)
        : f.sort === "price-desc"
          ? desc(products.price)
          : sql`${products.publishedAt} desc nulls last`;
    const rows = await getDatabase()
      .select({ ...publicProductFields, image: primaryImage })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(where)
      .orderBy(sort, desc(products.id))
      .limit(pageSize + 1)
      .offset((f.page - 1) * pageSize);
    return {
      items: rows
        .slice(0, pageSize)
        .map(({ image, ...p }) => ({ ...p, image: publicImage(image) })),
      hasNext: rows.length > pageSize,
    };
  });
}
export type CatalogProduct = Awaited<
  ReturnType<typeof listCatalog>
>["items"][number];
export async function listCategories() {
  return databaseOperation(() =>
    getDatabase()
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
      })
      .from(categories)
      .where(publicCategory)
      .orderBy(asc(categories.sortOrder), asc(categories.id))
      .limit(100),
  );
}
export async function getCategory(slug: string) {
  if (!slugInput.safeParse(slug).success) return null;
  return databaseOperation(
    async () =>
      (
        await getDatabase()
          .select({
            id: categories.id,
            name: categories.name,
            slug: categories.slug,
            description: categories.description,
            seoTitle: categories.seoTitle,
            seoDescription: categories.seoDescription,
          })
          .from(categories)
          .where(and(publicCategory, eq(categories.slug, slug)))
          .limit(1)
      )[0] ?? null,
  );
}
export async function catalogFacets(category?: string) {
  return databaseOperation(async () => {
    const where = and(
      publicCategory,
      publicStates,
      category ? eq(categories.slug, category) : undefined,
    );
    const [sizes, conditions, prices] = await Promise.all([
      getDatabase()
        .selectDistinct({ value: products.sizeLabel })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(where)
        .orderBy(asc(products.sizeLabel))
        .limit(60),
      getDatabase()
        .selectDistinct({ value: products.conditionGrade })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(where)
        .orderBy(asc(products.conditionGrade))
        .limit(30),
      getDatabase()
        .select({
          min: sql<number>`min(${products.price})`,
          max: sql<number>`max(${products.price})`,
        })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(where),
    ]);
    return {
      sizes: sizes.flatMap((r) => (r.value ? [r.value] : [])),
      conditions: conditions.flatMap((r) => (r.value ? [r.value] : [])),
      hasPrices: prices[0]?.min !== null && prices[0]?.min !== prices[0]?.max,
    };
  });
}
export async function getProduct(slug: string) {
  if (!slugInput.safeParse(slug).success) return null;
  return databaseOperation(async () => {
    const [product] = await getDatabase()
      .select({
        ...publicProductFields,
        sku: products.sku,
        description: products.description,
        shortDescription: products.shortDescription,
        brand: products.brand,
        conditionGrade: products.conditionGrade,
        conditionNotes: products.conditionNotes,
        defectNotes: products.defectNotes,
        seoTitle: products.seoTitle,
        seoDescription: products.seoDescription,
        categoryId: categories.id,
        categoryName: categories.name,
        categorySlug: categories.slug,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(publicCategory, publicStates, eq(products.slug, slug)))
      .limit(1);
    if (!product) return null;
    const [images, measurements] = await Promise.all([
      getDatabase()
        .select(imageFields)
        .from(productImages)
        .where(
          and(
            eq(productImages.productId, product.id),
            or(
              sql`${productImages.groupId} is null`,
              eq(productImages.variant, "detail"),
            ),
          ),
        )
        .orderBy(asc(productImages.sortOrder), asc(productImages.id))
        .limit(40),
      getDatabase()
        .select({
          id: productMeasurements.id,
          label: productMeasurements.label,
          value: productMeasurements.value,
          unit: productMeasurements.unit,
        })
        .from(productMeasurements)
        .where(eq(productMeasurements.productId, product.id))
        .orderBy(
          asc(productMeasurements.sortOrder),
          asc(productMeasurements.id),
        )
        .limit(30),
    ]);
    return {
      ...product,
      images: images.flatMap((i) => {
        const image = publicImage(i);
        return image ? [image] : [];
      }),
      measurements,
    };
  });
}
export async function relatedProducts(productId: string, categoryId: string) {
  return databaseOperation(async () => {
    const rows = await getDatabase()
      .select({ ...publicProductFields, image: primaryImage })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(
        and(
          publicCategory,
          eq(products.status, "active"),
          gt(products.quantity, 0),
          eq(products.categoryId, categoryId),
          ne(products.id, productId),
        ),
      )
      .orderBy(sql`${products.publishedAt} desc nulls last`, desc(products.id))
      .limit(4);
    return rows.map(({ image, ...p }) => ({ ...p, image: publicImage(image) }));
  });
}
export async function sitemapCount() {
  return databaseOperation(async () => {
    const [result] = await getDatabase()
      .select({
        count: sql<number>`greatest(count(*)::integer, (select count(*)::integer from categories where active = true))`,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(publicCategory, eq(products.status, "active")));
    return result?.count ?? 0;
  });
}
export async function sitemapBatch(page: number) {
  return databaseOperation(() =>
    getDatabase()
      .select({ slug: products.slug, updatedAt: products.updatedAt })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(publicCategory, eq(products.status, "active")))
      .orderBy(asc(products.id))
      .limit(1000)
      .offset(page * 1000),
  );
}

export async function sitemapCategories(page: number) {
  return databaseOperation(() =>
    getDatabase()
      .select({ slug: categories.slug })
      .from(categories)
      .where(publicCategory)
      .orderBy(asc(categories.id))
      .limit(1000)
      .offset(page * 1000),
  );
}
