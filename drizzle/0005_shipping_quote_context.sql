ALTER TABLE "shipping_quotes" ADD COLUMN "context_fingerprint" text;--> statement-breakpoint
ALTER TABLE "shipping_quotes" ADD COLUMN "test_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_quotes" ADD COLUMN "courier_name" text;--> statement-breakpoint
ALTER TABLE "shipping_quotes" ADD COLUMN "service_name" text;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "shipping_origin" jsonb;--> statement-breakpoint
ALTER TABLE "shipping_quotes" ADD CONSTRAINT "quote_context_valid" CHECK ("shipping_quotes"."context_fingerprint" is null or "shipping_quotes"."context_fingerprint" ~ '^[a-f0-9]{64}$');