CREATE TABLE "qris_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"merchant_name" text,
	"image_object_key" text NOT NULL,
	"instructions" text,
	"active" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qris_singleton" CHECK ("qris_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "bank_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "bank_snapshot" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "logo_object_key" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "qris_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "qris_settings" ADD CONSTRAINT "qris_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;