CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'reserved', 'sold', 'archived');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'payment_submitted', 'payment_verified', 'processing', 'shipped', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'submitted', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('reserved', 'released', 'sold');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_metadata_object" CHECK (jsonb_typeof("audit_logs"."metadata_json") = 'object')
);
--> statement-breakpoint
CREATE TABLE "bootstrap_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bootstrap_singleton" CHECK ("bootstrap_state"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "login_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_attempts_positive" CHECK ("login_rate_limits"."attempts" > 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "categories_slug_valid" CHECK ("categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"alt_text" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"mime_type" text NOT NULL,
	"variant" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_defect_image" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "images_dimensions_valid" CHECK ("product_images"."width" > 0 and "product_images"."height" > 0 and "product_images"."bytes" > 0),
	CONSTRAINT "images_public_key" CHECK ("product_images"."object_key" like 'product/%' and "product_images"."object_key" not like '%..%')
);
--> statement-breakpoint
CREATE TABLE "product_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"value" numeric(8, 2) NOT NULL,
	"unit" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "measurements_positive" CHECK ("product_measurements"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_description" text,
	"description" text NOT NULL,
	"brand" text,
	"category_id" uuid NOT NULL,
	"price" bigint NOT NULL,
	"compare_at_price" bigint,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"size_label" text,
	"condition_grade" text,
	"condition_notes" text NOT NULL,
	"defect_notes" text,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"weight_grams" integer,
	"promotion_eligible" boolean DEFAULT false NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_price_valid" CHECK ("products"."price" between 0 and 9007199254740991),
	CONSTRAINT "products_compare_price_valid" CHECK ("products"."compare_at_price" is null or "products"."compare_at_price" between 0 and 9007199254740991),
	CONSTRAINT "products_quantity_valid" CHECK ("products"."quantity" >= 0),
	CONSTRAINT "products_currency_idr" CHECK ("products"."currency" = 'IDR'),
	CONSTRAINT "products_stock_state_valid" CHECK (("products"."status" <> 'active' or "products"."quantity" > 0) and ("products"."status" not in ('sold', 'reserved') or "products"."quantity" = 0)),
	CONSTRAINT "products_weight_valid" CHECK ("products"."weight_grams" is null or "products"."weight_grams" > 0),
	CONSTRAINT "products_slug_valid" CHECK ("products"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "promotion_products" (
	"promotion_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	CONSTRAINT "promotion_products_promotion_id_product_id_pk" PRIMARY KEY("promotion_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'quantity_bundle' NOT NULL,
	"required_quantity" integer NOT NULL,
	"bundle_price" bigint NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"priority" integer DEFAULT 0 NOT NULL,
	"allocation_strategy" text,
	"price_policy" text,
	"category_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_price_valid" CHECK ("promotions"."bundle_price" between 0 and 9007199254740991),
	CONSTRAINT "promotions_quantity_valid" CHECK ("promotions"."required_quantity" >= 2 and "promotions"."required_quantity" <= 100),
	CONSTRAINT "promotions_type_valid" CHECK ("promotions"."type" = 'quantity_bundle'),
	CONSTRAINT "promotions_schedule_valid" CHECK ("promotions"."ends_at" is null or "promotions"."starts_at" is null or "promotions"."ends_at" > "promotions"."starts_at"),
	CONSTRAINT "promotions_strategy_valid" CHECK ("promotions"."allocation_strategy" is null or "promotions"."allocation_strategy" in ('highest_price_first','lowest_price_first')),
	CONSTRAINT "promotions_policy_valid" CHECK ("promotions"."price_policy" is null or "promotions"."price_policy" in ('discount_only','fixed_bundle')),
	CONSTRAINT "promotions_active_configured" CHECK (not "promotions"."active" or ("promotions"."allocation_strategy" is not null and "promotions"."price_policy" is not null))
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"recipient_name" text NOT NULL,
	"phone" text NOT NULL,
	"address_line" text NOT NULL,
	"province" text NOT NULL,
	"city" text NOT NULL,
	"district" text NOT NULL,
	"subdistrict" text,
	"postal_code" text NOT NULL,
	"provider_destination_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "address_customer_identity" UNIQUE("id","customer_id")
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_holder" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_number_valid" CHECK ("bank_accounts"."account_number" ~ '^[0-9]{4,40}$')
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"sku_snapshot" text NOT NULL,
	"name_snapshot" text NOT NULL,
	"slug_snapshot" text NOT NULL,
	"price_snapshot" bigint NOT NULL,
	"size_snapshot" text,
	"condition_snapshot" text NOT NULL,
	"image_snapshot" text,
	"quantity" integer NOT NULL,
	"original_line_total" bigint NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"surcharge_total" bigint DEFAULT 0 NOT NULL,
	"line_total" bigint NOT NULL,
	CONSTRAINT "items_price_valid" CHECK ("order_items"."price_snapshot" between 0 and 9007199254740991),
	CONSTRAINT "items_line_valid" CHECK ("order_items"."line_total" between 0 and 9007199254740991),
	CONSTRAINT "items_discount_valid" CHECK ("order_items"."discount_total" between 0 and 9007199254740991),
	CONSTRAINT "items_surcharge_valid" CHECK ("order_items"."surcharge_total" between 0 and 9007199254740991),
	CONSTRAINT "items_totals_consistent" CHECK ("order_items"."quantity" > 0 and "order_items"."original_line_total" = "order_items"."price_snapshot" * "order_items"."quantity" and "order_items"."line_total" = "order_items"."original_line_total" - "order_items"."discount_total" + "order_items"."surcharge_total" and "order_items"."discount_total" <= "order_items"."original_line_total")
);
--> statement-breakpoint
CREATE TABLE "order_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"promotion_id_snapshot" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"required_quantity_snapshot" integer NOT NULL,
	"bundle_price_snapshot" bigint NOT NULL,
	"bundle_count" integer NOT NULL,
	"discount_amount" bigint NOT NULL,
	"surcharge_amount" bigint DEFAULT 0 NOT NULL,
	"allocation_strategy_snapshot" text NOT NULL,
	"price_policy_snapshot" text NOT NULL,
	"allocations" jsonb NOT NULL,
	CONSTRAINT "order_promotions_quantity_valid" CHECK ("order_promotions"."bundle_count" > 0 and "order_promotions"."required_quantity_snapshot" >= 2),
	CONSTRAINT "order_promotions_discount_valid" CHECK ("order_promotions"."discount_amount" between 0 and 9007199254740991),
	CONSTRAINT "order_promotions_surcharge_valid" CHECK ("order_promotions"."surcharge_amount" between 0 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"note" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"public_token_hash" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"address_id" uuid NOT NULL,
	"address_snapshot" jsonb NOT NULL,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"subtotal" bigint NOT NULL,
	"discount_total" bigint DEFAULT 0 NOT NULL,
	"surcharge_total" bigint DEFAULT 0 NOT NULL,
	"merchandise_total" bigint NOT NULL,
	"shipping_cost" bigint NOT NULL,
	"grand_total" bigint NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"shipping_quote_id" uuid NOT NULL,
	"shipping_provider" text NOT NULL,
	"shipping_courier" text NOT NULL,
	"shipping_service" text NOT NULL,
	"shipping_etd" text,
	"payment_due_at" timestamp with time zone NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_public_token_hash_unique" UNIQUE("public_token_hash"),
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "orders_shipping_quote_id_unique" UNIQUE("shipping_quote_id"),
	CONSTRAINT "orders_subtotal_valid" CHECK ("orders"."subtotal" between 0 and 9007199254740991),
	CONSTRAINT "orders_discount_valid" CHECK ("orders"."discount_total" between 0 and 9007199254740991),
	CONSTRAINT "orders_surcharge_valid" CHECK ("orders"."surcharge_total" between 0 and 9007199254740991),
	CONSTRAINT "orders_merchandise_valid" CHECK ("orders"."merchandise_total" between 0 and 9007199254740991),
	CONSTRAINT "orders_shipping_valid" CHECK ("orders"."shipping_cost" between 0 and 9007199254740991),
	CONSTRAINT "orders_total_valid" CHECK ("orders"."grand_total" between 0 and 9007199254740991),
	CONSTRAINT "orders_totals_consistent" CHECK ("orders"."discount_total" <= "orders"."subtotal" and "orders"."merchandise_total" = "orders"."subtotal" - "orders"."discount_total" + "orders"."surcharge_total" and "orders"."grand_total" = "orders"."merchandise_total" + "orders"."shipping_cost"),
	CONSTRAINT "orders_currency_idr" CHECK ("orders"."currency" = 'IDR'),
	CONSTRAINT "orders_token_hash_valid" CHECK ("orders"."public_token_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "payment_proof_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"validated_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "payment_proof_receipts_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "proof_receipt_private" CHECK ("payment_proof_receipts"."object_key" like 'payment-proof/%' and "payment_proof_receipts"."object_key" not like '%..%'),
	CONSTRAINT "proof_receipt_size" CHECK ("payment_proof_receipts"."bytes" between 1 and 10485760),
	CONSTRAINT "proof_receipt_mime" CHECK ("payment_proof_receipts"."mime" in ('image/jpeg','image/png','image/webp'))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"method" text DEFAULT 'bank_transfer' NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"bank_snapshot" jsonb NOT NULL,
	"expected_amount" bigint NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"proof_object_key" text,
	"proof_mime" text,
	"proof_bytes" integer,
	"submitted_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "payment_amount_valid" CHECK ("payments"."expected_amount" between 0 and 9007199254740991),
	CONSTRAINT "payment_method_valid" CHECK ("payments"."method" = 'bank_transfer'),
	CONSTRAINT "payment_proof_private" CHECK ("payments"."proof_object_key" is null or ("payments"."proof_object_key" like 'payment-proof/%' and "payments"."proof_object_key" not like '%..%')),
	CONSTRAINT "payment_submission_valid" CHECK ("payments"."status" = 'pending' or ("payments"."proof_object_key" is not null and "payments"."proof_mime" is not null and "payments"."proof_bytes" is not null and "payments"."proof_bytes" > 0 and "payments"."submitted_at" is not null)),
	CONSTRAINT "payment_verification_valid" CHECK ("payments"."status" <> 'verified' or ("payments"."verified_by" is not null and "payments"."verified_at" is not null)),
	CONSTRAINT "payment_rejection_valid" CHECK ("payments"."status" <> 'rejected' or ("payments"."rejection_reason" is not null and length(trim("payments"."rejection_reason")) > 0))
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"status" "reservation_status" DEFAULT 'reserved' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservation_order_product_unique" UNIQUE("order_id","product_id"),
	CONSTRAINT "reservation_quantity_positive" CHECK ("reservations"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"order_id" uuid,
	"reviewer_name" text NOT NULL,
	"rating" smallint NOT NULL,
	"body" text NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"moderated_by" uuid,
	"moderated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_rating_range" CHECK ("reviews"."rating" between 1 and 5),
	CONSTRAINT "review_moderation_required" CHECK ("reviews"."status" = 'pending' or ("reviews"."moderated_by" is not null and "reviews"."moderated_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"courier" text NOT NULL,
	"service" text NOT NULL,
	"tracking_number" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "shipment_state_valid" CHECK ("shipments"."status" in ('pending','shipped','delivered')),
	CONSTRAINT "shipment_tracking_required" CHECK ("shipments"."status" = 'pending' or ("shipments"."tracking_number" is not null and length(trim("shipments"."tracking_number")) > 0 and "shipments"."shipped_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "shipping_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"address_id" uuid NOT NULL,
	"cart_fingerprint" text NOT NULL,
	"provider" text NOT NULL,
	"courier" text NOT NULL,
	"service" text NOT NULL,
	"cost" bigint NOT NULL,
	"etd" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_cost_valid" CHECK ("shipping_quotes"."cost" between 0 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"internal_name" text NOT NULL,
	"headline" text,
	"body" text,
	"image_object_key" text,
	"mobile_image_object_key" text,
	"cta_label" text,
	"cta_url" text,
	"active" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "banner_schedule_valid" CHECK ("banners"."ends_at" is null or "banners"."starts_at" is null or "banners"."ends_at" > "banners"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "seo_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"site_title" text NOT NULL,
	"title_template" text NOT NULL,
	"default_description" text NOT NULL,
	"default_og_image" text,
	"homepage_title" text,
	"homepage_description" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seo_singleton" CHECK ("seo_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"store_name" text NOT NULL,
	"whatsapp_number" text,
	"support_email" text,
	"display_address" text,
	"reservation_minutes" integer,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_singleton" CHECK ("store_settings"."id" = 1),
	CONSTRAINT "store_reservation_minutes_valid" CHECK ("store_settings"."reservation_minutes" is null or "store_settings"."reservation_minutes" between 1 and 10080)
);
--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "is_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_measurements" ADD CONSTRAINT "product_measurements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_promotions" ADD CONSTRAINT "order_promotions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_quote_id_shipping_quotes_id_fk" FOREIGN KEY ("shipping_quote_id") REFERENCES "public"."shipping_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "order_address_customer_fk" FOREIGN KEY ("address_id","customer_id") REFERENCES "public"."addresses"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proof_receipts" ADD CONSTRAINT "payment_proof_receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_quotes" ADD CONSTRAINT "shipping_quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_quotes" ADD CONSTRAINT "shipping_quotes_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_quotes" ADD CONSTRAINT "quote_address_customer_fk" FOREIGN KEY ("address_id","customer_id") REFERENCES "public"."addresses"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_settings" ADD CONSTRAINT "seo_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_actor_created_idx" ON "audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_created_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "login_rate_limits_expiry_idx" ON "login_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "images_product_sort_idx" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE INDEX "measurements_product_idx" ON "product_measurements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_status_published_idx" ON "products" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "products_category_status_idx" ON "products" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "promotions_active_schedule_idx" ON "promotions" USING btree ("active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "addresses_customer_idx" ON "addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "items_product_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_promotions_order_idx" ON "order_promotions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_history_order_created_idx" ON "order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_expiry_idx" ON "orders" USING btree ("status","payment_due_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "proof_receipts_order_idx" ON "payment_proof_receipts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_submitted_idx" ON "payments" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "reservation_product_status_idx" ON "reservations" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "reservation_expiry_idx" ON "reservations" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "reviews_product_status_created_idx" ON "reviews" USING btree ("product_id","status","created_at");--> statement-breakpoint
CREATE INDEX "reviews_moderation_queue_idx" ON "reviews" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "quote_expiry_idx" ON "shipping_quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "banner_active_sort_idx" ON "banners" USING btree ("active","sort_order");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_one_owner" ON "roles" USING btree ("is_owner") WHERE "roles"."is_owner" = true;--> statement-breakpoint
CREATE INDEX "users_role_status_idx" ON "users" USING btree ("role_id","status");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized" CHECK ("users"."email" = lower(trim("users"."email")));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_session_version_nonnegative" CHECK ("users"."session_version" >= 0);