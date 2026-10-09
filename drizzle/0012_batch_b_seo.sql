ALTER TABLE "seo_settings" ADD COLUMN "indexing_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "seo_settings" ADD COLUMN "pages" jsonb DEFAULT '[]'::jsonb NOT NULL;