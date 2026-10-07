import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  index,
  check,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, at, createdAt } from "./shared";
import { products } from "./catalog";
import { users } from "./identity";
export const mediaUploads = pgTable(
  "media_uploads",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sourceKey: text("source_key").notNull().unique(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    variantKeys: jsonb("variant_keys")
      .$type<Record<"thumbnail" | "card" | "detail", string>>()
      .notNull(),
    altText: text("alt_text").notNull(),
    isDefectImage: boolean("is_defect_image").notNull().default(false),
    ready: boolean("ready").notNull().default(false),
    expiresAt: at("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("media_uploads_expiry_idx").on(t.expiresAt),
    index("media_uploads_product_idx").on(t.productId),
    check("media_uploads_bytes_valid", sql`${t.bytes} between 1 and 10485760`),
    check(
      "media_uploads_source_private",
      sql`${t.sourceKey} like 'product-source/%' and ${t.sourceKey} not like '%..%'`,
    ),
  ],
);
export const mediaDeletions = pgTable(
  "media_deletions",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    objectKey: text("object_key").notNull().unique(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("media_deletions_product_idx").on(t.productId),
    check(
      "media_deletions_key_valid",
      sql`${t.objectKey} like 'product/%' and ${t.objectKey} not like '%..%'`,
    ),
  ],
);
