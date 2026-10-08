ALTER TABLE "payments" ADD COLUMN "proof_token_hash" text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_proof_token_hash_unique" UNIQUE("proof_token_hash");