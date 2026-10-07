-- Historical snapshots and audit trails are append-only at the SQL boundary.
CREATE FUNCTION forbid_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical records are immutable' USING ERRCODE = '23514'; END;
$$;
--> statement-breakpoint
CREATE TRIGGER immutable_order_items BEFORE UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_order_promotions BEFORE UPDATE OR DELETE ON order_promotions FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_order_history BEFORE UPDATE OR DELETE ON order_status_history FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
--> statement-breakpoint
CREATE TRIGGER immutable_audit_logs BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
--> statement-breakpoint
CREATE FUNCTION protect_order_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW) - ARRAY['status','updated_at','payment_due_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at','payment_due_at']) THEN
  RAISE EXCEPTION 'Order snapshot is immutable' USING ERRCODE = '23514';
 END IF;
 IF OLD.status <> NEW.status AND NOT (
  (OLD.status = 'pending_payment' AND NEW.status IN ('payment_submitted','cancelled','expired')) OR
  (OLD.status = 'payment_submitted' AND NEW.status IN ('payment_verified','pending_payment','cancelled')) OR
  (OLD.status = 'payment_verified' AND NEW.status = 'processing') OR
  (OLD.status = 'processing' AND NEW.status = 'shipped') OR
  (OLD.status = 'shipped' AND NEW.status = 'completed')
 ) THEN RAISE EXCEPTION 'Illegal order transition' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER order_snapshot_guard BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION protect_order_snapshot();
--> statement-breakpoint
CREATE FUNCTION protect_payment_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.expected_amount IS DISTINCT FROM OLD.expected_amount OR NEW.bank_snapshot IS DISTINCT FROM OLD.bank_snapshot OR NEW.bank_account_id IS DISTINCT FROM OLD.bank_account_id OR NEW.method IS DISTINCT FROM OLD.method THEN
  RAISE EXCEPTION 'Payment expectation is immutable' USING ERRCODE = '23514';
 END IF;
 IF OLD.status = 'verified' AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
  RAISE EXCEPTION 'Verified payment is immutable' USING ERRCODE = '23514';
 END IF;
 IF OLD.status <> NEW.status AND NOT (
  (OLD.status IN ('pending','rejected') AND NEW.status = 'submitted') OR
  (OLD.status = 'submitted' AND NEW.status IN ('verified','rejected'))
 ) THEN RAISE EXCEPTION 'Illegal payment transition' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER payment_state_guard BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION protect_payment_state();
--> statement-breakpoint
CREATE FUNCTION validate_order_totals() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id uuid; expected orders%ROWTYPE; lines_subtotal numeric; lines_total numeric; line_count integer;
BEGIN
 IF TG_TABLE_NAME = 'orders' THEN target_id := NEW.id; ELSE target_id := NEW.order_id; END IF;
 SELECT * INTO expected FROM orders WHERE id = target_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT count(*), coalesce(sum(original_line_total),0), coalesce(sum(line_total),0) INTO line_count, lines_subtotal, lines_total FROM order_items WHERE order_id = target_id;
 IF line_count = 0 OR lines_subtotal <> expected.subtotal OR lines_total <> expected.merchandise_total THEN
  RAISE EXCEPTION 'Order item totals do not match snapshot' USING ERRCODE = '23514';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM payments WHERE order_id = target_id AND expected_amount = expected.grand_total) THEN
  RAISE EXCEPTION 'Payment amount does not match order' USING ERRCODE = '23514';
 END IF;
 IF expected.discount_total - expected.surcharge_total <> (SELECT coalesce(sum(discount_amount - surcharge_amount),0) FROM order_promotions WHERE order_id = target_id) THEN
  RAISE EXCEPTION 'Promotion snapshot does not match order' USING ERRCODE = '23514';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM payments WHERE order_id = target_id AND (
   (expected.status IN ('pending_payment','expired') AND status IN ('pending','rejected')) OR
   (expected.status = 'payment_submitted' AND status = 'submitted') OR
   (expected.status IN ('payment_verified','processing','shipped','completed') AND status = 'verified') OR
   (expected.status = 'cancelled' AND status <> 'verified')
 )) THEN RAISE EXCEPTION 'Order and payment states disagree' USING ERRCODE = '23514'; END IF;
 RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER order_totals_guard AFTER INSERT OR UPDATE ON orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_order_totals();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER item_totals_guard AFTER INSERT ON order_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_order_totals();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER payment_totals_guard AFTER INSERT OR UPDATE ON payments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_order_totals();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER promotion_totals_guard AFTER INSERT ON order_promotions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_order_totals();
--> statement-breakpoint
CREATE FUNCTION validate_review_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = NEW.order_id AND product_id = NEW.product_id) THEN
  RAISE EXCEPTION 'Review order does not contain product' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER review_order_guard BEFORE INSERT OR UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION validate_review_order();
