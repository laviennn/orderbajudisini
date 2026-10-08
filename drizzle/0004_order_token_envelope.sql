ALTER TABLE "orders" ADD COLUMN "public_token_ciphertext" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_token_envelope_valid" CHECK ("orders"."public_token_ciphertext" is null or "orders"."public_token_ciphertext" ~ '^v1[.][a-f0-9]{24}[.][a-f0-9]{32}[.][a-f0-9]{64}$');--> statement-breakpoint
-- Enforce Phase 4A's discount-only contract on NEW snapshots. Historical fixed-bundle
-- snapshots remain immutable/readable and their existing status/expiry updates still work.
CREATE FUNCTION reject_order_surcharge() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF coalesce((to_jsonb(NEW)->>'surcharge_total')::bigint, (to_jsonb(NEW)->>'surcharge_amount')::bigint, 0) <> 0 THEN
  RAISE EXCEPTION 'New orders cannot increase prices through a bundle' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER new_order_discount_only BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION reject_order_surcharge();
--> statement-breakpoint
CREATE TRIGGER new_order_item_discount_only BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION reject_order_surcharge();
--> statement-breakpoint
CREATE TRIGGER new_order_promotion_discount_only BEFORE INSERT ON order_promotions FOR EACH ROW EXECUTE FUNCTION reject_order_surcharge();
