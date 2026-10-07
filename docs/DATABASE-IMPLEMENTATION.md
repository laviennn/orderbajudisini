# Phase 1A database implementation

The authoritative specifications remain in `documents/`. PostgreSQL is the source of truth; Drizzle uses the existing Neon WebSocket pool for interactive transactions. No Phase 1A migration has been applied to the production Neon database by this implementation task.

## Tables

| Domain                   | Tables                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Staff/security           | users, roles, permissions, role_permissions, login_rate_limits, bootstrap_state, audit_logs |
| Catalog/promotions       | categories, products, product_measurements, product_images, promotions, promotion_products  |
| Customers                | customers, addresses                                                                        |
| Commerce                 | orders, order_items, order_promotions, reservations, order_status_history                   |
| Payments                 | payments, bank_accounts, payment_proof_receipts                                             |
| Shipping                 | shipping_quotes, shipments                                                                  |
| Reviews/content/settings | reviews, banners, seo_settings, store_settings                                              |

Phase 1A introduced 29 application tables. Phase 3.5 migration 0003 adds `media_uploads` and `media_deletions` (31 total) and a nullable image-family ID with group/variant constraints; see [MEDIA-PIPELINE.md](MEDIA-PIPELINE.md) for ingestion and cleanup transactions. Additional tables have concrete purposes: distributed login throttling, one-time bootstrap closure, trusted shipping quotes, per-order inventory reservations, validated private-upload receipts, and historical promotion allocations. Credentials authentication uses encrypted Auth.js JWT sessions, so unused OAuth accounts/session/verification-token tables are not introduced.

## Constraints and indexes

UUID primary keys, explicit foreign keys and deletion behavior, timezone-aware timestamps, unique normalized staff email, category/product slugs, SKU, order number, public-token hash and checkout idempotency key are enforced in PostgreSQL. Customer/address composite foreign keys prevent cross-customer quotes/orders. Monetary columns are bigint integer IDR constrained to JavaScript's safe integer range; calculations reject overflow. Measurements use decimal centimeters, not floating-point money.

Database checks enforce nonnegative prices/stock, positive line quantities, rating 1–5, valid media dimensions, reservation consistency, payment verification actor/time and rejection reason, shipping tracking requirements, and valid configured promotion rules. Domain states are centralized in `src/lib/domain/states.ts` and represented by PostgreSQL enums.

Indexes cover role/status membership, catalog category/status and recent products, media ordering, order/customer/state queues, reservation status/expiry, moderation queues, audit actor/entity/time and login expiry. Uniqueness indexes protect idempotency, one payment per order and one reservation per order/product. The schema files and generated SQL are the exact inventory of indexes and foreign-key deletion actions.

Migration 0002 adds database guards: immutable order items/promotion snapshots/history/audits; order/payment transition graphs; immutable financial and customer snapshots; immutable verified payments; deferred aggregate checks for line/promotion/payment totals and order/payment state agreement. Linked reviews must reference an order containing the product. Database administrators can bypass protections; application credentials must not be shared with clients.

## Transactions and inventory

`createReservedOrder` accepts product IDs/quantities, customer/address, bank, trusted quote and idempotency key; it never accepts authoritative totals. It reads prices and promotion rules from PostgreSQL and writes order, item/promotion/address/bank snapshots, reservations, payment and history in one transaction. A failed insert rolls back all stock changes. Quote ownership, expiry and cart/weight fingerprint are checked.

Checkout serializes the same idempotency key with a transaction advisory lock, locks products in sorted UUID order, and uses conditional stock updates requiring active status and sufficient quantity. With quantity one, competing transactions cannot both decrement the stock. The loser receives PRODUCT_UNAVAILABLE; no orphan order remains. A real PostgreSQL integration test runs competing requests and verifies exactly one success.

Stock quantity means available units. Reserved products with no available units have reserved status; remaining available units keep active status. Reservation records distinguish allocations across orders. Verification consumes reserved units once; cancellation/expiry restores them once. Sold status is applied when no available or outstanding reserved units remain. Tests cover quantity one, partial quantities, rollback and repeated/concurrent release/verification.

Mutating an order first locks that order; reservation operations then lock reservation/product records in deterministic order. Expiry workers select eligible pending-payment orders with FOR UPDATE SKIP LOCKED. Staff mutations hold a shared identity advisory lock; operator changes/bootstrap take the exclusive version. Promotion edits use a separate exclusive advisory lock while checkout holds its shared version.

`store_settings.reservation_minutes` must be explicitly configured. No business TTL is invented. Submitted proofs remain reserved for manual review; rejection returns the order to pending_payment without extending its deadline. The internal expiry helper is implemented; deployment scheduling and review escalation policy belong to the checkout/payment release. No public cron endpoint exists yet.

## Boundaries and snapshots

Order items preserve SKU, name, slug, size, condition, representative image, quantity and original/final monetary allocations. Promotions preserve names/rules/allocations even after campaign edits. Addresses and bank details are snapshots. Order capability tokens are stored only as hashes; deterministic HMAC generation permits safe idempotent retries and requires AUTH_SECRET. Keep tokens out of logs/analytics; public guest lookup endpoints are deferred.

Product images contain object keys and metadata only. Proofs remain private R2 objects. The receipt boundary accepts only previously validated, unexpired, order-bound upload receipts, consumes each once and changes payment only to submitted. Receipt issuance, byte inspection, signing orchestration and upload UI are intentionally deferred; no endpoint can create a trusted receipt in this phase.

Public review queries return only approved reviews and derive verified purchase from a matching completed order. Staff moderation uses a separate permission-checked path. SEO, bank, operator, promotion and settings services provide typed, validated mutations with atomic audits. Audit metadata is a strict allowlist; passwords, tokens, proof bytes and secrets are not accepted.

## Setup and migrations

Use a dedicated Neon development branch; never point development seeding at production. Configure DATABASE_URL privately in `.env.local` or the process environment. Shell variables take precedence.

```sh
npm ci
npm run db:check
npm run db:migrate
# Optional, development database only:
NODE_ENV=development ALLOW_DEVELOPMENT_SEED=true npm run db:seed:dev
npm run admin:bootstrap
```

0000 preserves Phase 0 identity tables; 0001 adds the domains and constraints; 0002 adds PostgreSQL trigger guards. SQL and Drizzle snapshots/journal are source-controlled deliverables. Run migrations once through an explicit release step, never during builds. For schema changes use `npm run db:generate`, review generated SQL, and create custom migrations for guards Drizzle cannot represent. Do not edit already applied migrations. Existing nonempty databases require a data compatibility review and backup before migration.

The optional seed inserts only roles/permissions, no accounts or fabricated commerce records. It requires both development flags and refuses Vercel. Production bootstrap initializes access-control defaults itself.

## Verification

`npm run test:integration` starts a disposable real PostgreSQL 18 cluster with random credentials under the OS temporary directory, applies all migrations, exercises production services/queries and destroys the cluster. It does not use DATABASE_URL or contact Neon. The test-only pg pool implements the query protocol needed by the production Drizzle dialect; Neon transport connectivity is a separate deployment check. Integration tests cover database constraints, financial/state guards, concurrency, rollback, Auth.js cookies/CSRF, revocation, RBAC, owner lockout, reviews and audit integrity. `db:check` alone validates metadata, not SQL execution.
