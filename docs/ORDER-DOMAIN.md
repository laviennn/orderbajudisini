# Phase 4A — transactional order domain

This phase reuses `createReservedOrder`, the existing pricing engine, inventory helpers, snapshots and PostgreSQL guards. It adds no checkout endpoint/UI, shipping provider, payment-proof flow, verification or cron.

## Transaction flow and concurrency

`createReservedOrder` strictly accepts product IDs/quantities, a UUID idempotency key and the existing internal customer/address/bank/quote references. UUIDs normalize to lowercase before duplicate detection and request hashing. Monetary or eligibility fields from clients are rejected.

One PostgreSQL transaction:

1. Locks the idempotency key with an advisory transaction lock and checks for an identical committed request.
2. Takes the existing shared promotion lock (`73102`); validates configured reservation duration, address ownership, active bank and trusted quote.
3. Locks requested products in ascending UUID order with `FOR UPDATE`; checks active status, sufficient stock and active categories under shared category locks.
4. Reads current prices/eligibility/campaigns from PostgreSQL. Uses database time after lock acquisition to check quote validity and calculate reservation expiry.
5. Inserts `pending_payment` order, immutable item/promotion snapshots, conditionally decrements stock and inserts reservations, then writes the existing pending payment record and initial status history.
6. Commits everything together. Any failure rolls back inventory, order, items, promotions, payment, reservations and history.

The conditional decrement requires active status and sufficient quantity even though rows are already locked. Quantity one becomes zero/reserved. Partial stock remains active with its remaining available quantity, preserving the existing multi-unit model. Expiry locks the order and then reservations/products in consistent order. No availability check outside the transaction can authorize a sale.

Shipping is not calculated or integrated here. The pre-existing schema still requires a trusted persisted quote, address and bank snapshot; that contract was deliberately preserved rather than weakening constraints or inventing free shipping. Focused tests use isolated TEST quote fixtures. `merchandiseTotal` excludes shipping; the existing `grandTotal` additionally includes the trusted quote cost. Phase 4B must supply real validated checkout context/quotes before customer use.

## Pricing authority

Active matching bundle campaigns now require 3 items and a Rp100,000 cap. Eligibility, category/product targets, schedules and deterministic ordering are reused. The configured price ordering remains highest-price-first or lowest-price-first, with product ID/unit index tie-breaks.

Each complete eligible group costs `min(sum(normal prices), 100000)`. Remainders and ineligible items retain normal prices; multiple groups are supported. Allocation uses integer IDR with deterministic proportional rounding. Groups whose normal total is already at/below the cap are consumed once but generate no applied-discount snapshot; their unchanged prices remain in item snapshots, preserving the existing cart display contract. Even legacy `fixed_bundle` configurations cannot introduce a surcharge; new snapshots record the effective `discount_only` policy. New campaign activation rejects conflicting terms. No campaign is automatically created or activated.

For every new order: `merchandiseTotal = subtotal - discountTotal`, and surcharge is zero. Existing surcharge columns/history remain for compatibility. Migration 0004 adds insert guards to orders, items and promotion snapshots so new surcharges are rejected at the SQL boundary without rewriting historical orders.

## Snapshots, access and retries

Items retain product reference, SKU/name/slug, listed price, size, grade/condition/defect notes, representative image key, quantity, original/final line amounts and allocated discount. Campaign terms, effective policy, bundle count and allocations are also snapshots. Existing append-only triggers prevent later catalog/promotion edits or direct snapshot updates from changing history.

Order numbers remain human-readable unique references, never access credentials. New public tokens use `randomBytes(32)`. The existing unique SHA-256 hash remains the verifier. To return the identical token after a lost-response retry, the sole added column is nullable `orders.public_token_ciphertext`: AES-256-GCM with a random nonce, an AUTH_SECRET-derived purpose-specific key and order-ID authenticated data. Raw tokens are not stored or logged. Old rows retain their earlier HMAC retry behavior; new tokens are independent of client-chosen idempotency keys. Rotating AUTH_SECRET without retaining the old encryption key prevents recovery of earlier tokens on retry; it does not change their stored verifier.

Same normalized key/request returns the existing order, total and token, including after expiry; it never reserves again. Changed payloads using the same key return `CONFLICT`. The internal returned database ID is not a customer access credential. Phase 4B must authenticate guest context, apply rate limits and expose only an appropriate public projection.

## Expiry and verification

`releaseExpiredReservations(limit)` rechecks pending-payment status and deadline under `FOR UPDATE SKIP LOCKED`, releases each eligible reservation once and transitions to expired with history/audit in the same transaction. Repeated/concurrent calls do not add stock twice. There is no scheduler in this phase.

Focused verification:

- Pricing/token unit tests: **21 passed**.
- Real PostgreSQL order tests: **17 passed**; no SQL/lock/inventory mocks. Only the database factory points to isolated PostgreSQL, and the unused staff-auth runtime is excluded.
- Mandatory contention test holds the product lock until `pg_stat_activity` proves **two transactions waiting**, then releases it: **1 success, 1 PRODUCT_UNAVAILABLE, 1 pending-payment order, 1 valid reservation, stock 0/reserved**.
- Covers both sides of the price cap, mixed eligibility, multiple bundles/remainders, current DB prices, rejected client totals, immutable snapshots, late-failure rollback, retry normalization, expiry idempotency, unavailable products and SQL surcharge rejection.
- Normal TypeScript check, ESLint on changed files and Drizzle metadata check passed. Migrations 0000–0004 applied to the disposable test database. No production migration or deployment was performed; unrelated browser/media/admin/storefront tests and visual QA were not run.

Commands: `npx vitest run tests/pricing.test.ts tests/order-tokens.test.ts`; `npx vitest run --config vitest.integration.config.ts tests/integration/order-domain.test.ts`. Apply `drizzle/0004_order_token_envelope.sql` through the normal migration process before releasing this code.
