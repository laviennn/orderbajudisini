import { sql } from "drizzle-orm";
import {
  pgTable,
  jsonb,
  text,
  uuid,
  integer,
  boolean,
  check,
  index,
} from "drizzle-orm/pg-core";
import { id, at, createdAt, updatedAt } from "./shared";
import type { ShippingDestination } from "@/server/shipping/contract";
import { users } from "./identity";
export const banners = pgTable(
  "banners",
  {
    id: id(),
    internalName: text("internal_name").notNull(),
    headline: text("headline"),
    body: text("body"),
    imageObjectKey: text("image_object_key"),
    mobileImageObjectKey: text("mobile_image_object_key"),
    ctaLabel: text("cta_label"),
    ctaUrl: text("cta_url"),
    active: boolean("active").notNull().default(false),
    startsAt: at("starts_at"),
    endsAt: at("ends_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "banner_schedule_valid",
      sql`${t.endsAt} is null or ${t.startsAt} is null or ${t.endsAt} > ${t.startsAt}`,
    ),
    index("banner_active_sort_idx").on(t.active, t.sortOrder),
  ],
);
import type { SocialSettings } from "@/lib/social-settings";
import type { PageSeo } from "@/lib/seo-settings";
export const seoSettings = pgTable(
  "seo_settings",
  {
    id: integer("id").primaryKey().default(1),
    siteTitle: text("site_title").notNull(),
    indexingEnabled: boolean("indexing_enabled").notNull().default(true),
    pages: jsonb("pages").$type<PageSeo[]>().notNull().default([]),
    titleTemplate: text("title_template").notNull(),
    defaultDescription: text("default_description").notNull(),
    defaultOgImage: text("default_og_image"),
    homepageTitle: text("homepage_title"),
    homepageDescription: text("homepage_description"),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    updatedAt: updatedAt(),
  },
  (t) => [check("seo_singleton", sql`${t.id} = 1`)],
);
export const storeSettings = pgTable(
  "store_settings",
  {
    id: integer("id").primaryKey().default(1),
    storeName: text("store_name").notNull(),
    description: text("description"),
    logoObjectKey: text("logo_object_key"),
    faviconObjectKey: text("favicon_object_key"),
    footerText: text("footer_text"),
    socialLinks: jsonb("social_links").$type<SocialSettings>(),
    whatsappNumber: text("whatsapp_number"),
    supportEmail: text("support_email"),
    displayAddress: text("display_address"),
    shippingOrigin: jsonb("shipping_origin").$type<ShippingDestination>(),
    reservationMinutes: integer("reservation_minutes"),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("store_singleton", sql`${t.id} = 1`),
    check(
      "store_reservation_minutes_valid",
      sql`${t.reservationMinutes} is null or ${t.reservationMinutes} between 1 and 10080`,
    ),
  ],
);
