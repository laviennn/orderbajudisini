import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  uuid,
  integer,
  boolean,
  numeric,
  bigint,
  check,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { productStates } from "@/lib/domain/states";
import { id, at, amount, createdAt, updatedAt, moneyCheck } from "./shared";
import { users } from "./identity";
export const productStatus = pgEnum("product_status", productStates);
export const categories = pgTable(
  "categories",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("categories_slug_valid", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);
export const products = pgTable(
  "products",
  {
    id: id(),
    sku: text("sku").notNull().unique(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    shortDescription: text("short_description"),
    description: text("description").notNull(),
    brand: text("brand"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    price: amount("price"),
    compareAtPrice: bigint("compare_at_price", { mode: "number" }),
    currency: text("currency").notNull().default("IDR"),
    sizeLabel: text("size_label"),
    conditionGrade: text("condition_grade"),
    conditionNotes: text("condition_notes").notNull(),
    defectNotes: text("defect_notes"),
    status: productStatus("status").notNull().default("draft"),
    quantity: integer("quantity").notNull().default(1),
    weightGrams: integer("weight_grams"),
    promotionEligible: boolean("promotion_eligible").notNull().default(false),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: at("published_at"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    moneyCheck("products_price_valid", t.price),
    check(
      "products_compare_price_valid",
      sql`${t.compareAtPrice} is null or ${t.compareAtPrice} between 0 and 9007199254740991`,
    ),
    check("products_quantity_valid", sql`${t.quantity} >= 0`),
    check("products_currency_idr", sql`${t.currency} = 'IDR'`),
    check(
      "products_stock_state_valid",
      sql`(${t.status} <> 'active' or ${t.quantity} > 0) and (${t.status} not in ('sold', 'reserved') or ${t.quantity} = 0)`,
    ),
    check(
      "products_weight_valid",
      sql`${t.weightGrams} is null or ${t.weightGrams} > 0`,
    ),
    check("products_slug_valid", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    index("products_status_published_idx").on(t.status, t.publishedAt),
    index("products_category_status_idx").on(t.categoryId, t.status),
  ],
);
export const productMeasurements = pgTable(
  "product_measurements",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    value: numeric("value", { precision: 8, scale: 2 }).notNull(),
    unit: text("unit").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    check("measurements_positive", sql`${t.value} > 0`),
    index("measurements_product_idx").on(t.productId),
  ],
);
export const productImages = pgTable(
  "product_images",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    groupId: uuid("group_id"),
    objectKey: text("object_key").notNull().unique(),
    altText: text("alt_text").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    mimeType: text("mime_type").notNull(),
    variant: text("variant").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefectImage: boolean("is_defect_image").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "images_dimensions_valid",
      sql`${t.width} > 0 and ${t.height} > 0 and ${t.bytes} > 0`,
    ),
    check(
      "images_public_key",
      sql`${t.objectKey} like 'product/%' and ${t.objectKey} not like '%..%'`,
    ),
    index("images_product_sort_idx").on(t.productId, t.sortOrder),
    uniqueIndex("images_group_variant_unique")
      .on(t.groupId, t.variant)
      .where(sql`${t.groupId} is not null`),
    check(
      "images_group_variant_valid",
      sql`${t.groupId} is null or ${t.variant} in ('thumbnail','card','detail')`,
    ),
  ],
);
export const promotions = pgTable(
  "promotions",
  {
    id: id(),
    name: text("name").notNull(),
    type: text("type").notNull().default("quantity_bundle"),
    requiredQuantity: integer("required_quantity").notNull(),
    bundlePrice: amount("bundle_price"),
    active: boolean("active").notNull().default(false),
    startsAt: at("starts_at"),
    endsAt: at("ends_at"),
    priority: integer("priority").notNull().default(0),
    allocationStrategy: text("allocation_strategy"),
    pricePolicy: text("price_policy"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "restrict",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    moneyCheck("promotions_price_valid", t.bundlePrice),
    check(
      "promotions_quantity_valid",
      sql`${t.requiredQuantity} >= 2 and ${t.requiredQuantity} <= 100`,
    ),
    check("promotions_type_valid", sql`${t.type} = 'quantity_bundle'`),
    check(
      "promotions_schedule_valid",
      sql`${t.endsAt} is null or ${t.startsAt} is null or ${t.endsAt} > ${t.startsAt}`,
    ),
    check(
      "promotions_strategy_valid",
      sql`${t.allocationStrategy} is null or ${t.allocationStrategy} in ('highest_price_first','lowest_price_first')`,
    ),
    check(
      "promotions_policy_valid",
      sql`${t.pricePolicy} is null or ${t.pricePolicy} in ('discount_only','fixed_bundle')`,
    ),
    check(
      "promotions_active_configured",
      sql`not ${t.active} or (${t.allocationStrategy} is not null and ${t.pricePolicy} is not null)`,
    ),
    index("promotions_active_schedule_idx").on(t.active, t.startsAt, t.endsAt),
  ],
);
// Explicit optional targeting; no rows means all eligible products in the category scope.
export const promotionProducts = pgTable(
  "promotion_products",
  {
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.promotionId, t.productId] })],
);
