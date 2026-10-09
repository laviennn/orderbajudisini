ALTER TABLE "store_settings" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "logo_object_key" text;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "favicon_object_key" text;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "footer_text" text;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "social_links" jsonb;