CREATE TABLE "media_deletions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_deletions_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "media_deletions_key_valid" CHECK ("media_deletions"."object_key" like 'product/%' and "media_deletions"."object_key" not like '%..%')
);
--> statement-breakpoint
CREATE TABLE "media_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"variant_keys" jsonb NOT NULL,
	"alt_text" text NOT NULL,
	"is_defect_image" boolean DEFAULT false NOT NULL,
	"ready" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_uploads_source_key_unique" UNIQUE("source_key"),
	CONSTRAINT "media_uploads_bytes_valid" CHECK ("media_uploads"."bytes" between 1 and 10485760),
	CONSTRAINT "media_uploads_source_private" CHECK ("media_uploads"."source_key" like 'product-source/%' and "media_uploads"."source_key" not like '%..%')
);
--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "media_deletions" ADD CONSTRAINT "media_deletions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_uploads" ADD CONSTRAINT "media_uploads_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_uploads" ADD CONSTRAINT "media_uploads_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_deletions_product_idx" ON "media_deletions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "media_uploads_expiry_idx" ON "media_uploads" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "media_uploads_product_idx" ON "media_uploads" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "images_group_variant_unique" ON "product_images" USING btree ("group_id","variant") WHERE "product_images"."group_id" is not null;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "images_group_variant_valid" CHECK ("product_images"."group_id" is null or "product_images"."variant" in ('thumbnail','card','detail'));