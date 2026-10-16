ALTER TABLE "orders" ALTER COLUMN "payment_due_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "expires_at" DROP NOT NULL;