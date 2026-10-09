# Implementation plan

## Batch B — settings and content

SEO, banners, store identity/origin/footer and social settings are implemented on the verified Batch A base. See [BATCH-B-IMPLEMENTATION.md](BATCH-B-IMPLEMENTATION.md) for routes, permissions, migrations and media boundaries. Production storage override protection and actual QRIS image validation are included. Verification completed on 2026-10-09:

- `npm test`: **65 passed** (14 files).
- `npm run test:integration`: **85 passed** (12 files); fresh migrations through 0013 applied to isolated PostgreSQL.
- `npm run test:e2e`: **23 passed**; includes the new owner SEO/banner/store/social flow, logo/favicon and desktop/mobile uploads, mobile overflow and Axe checks.
- Typecheck, full ESLint, full Prettier check, `npm run db:check`, and `git diff --check`: passed.
- `npm run build -- --webpack`: passed. Default Turbopack could not bind its worker port in this execution environment; this is not reported as a successful Turbopack build. The supported webpack production build was used for browser regression.
- Existing QRIS/payment-proof test storage fixtures were updated to supply real image bytes and explicitly intercept test R2 I/O. Existing payment-queue async props and dashboard enum mistakes discovered by validation were corrected. Formatting-only cleanup is a separate commit.

No deployment, production migration, real R2 write or production shipping call was performed. Review/apply migrations 0012–0013 as part of a separately authorized release. Detached site-media cleanup remains an operational policy; uploaded images are validated but not decoded as QR merchant payloads.

## Current status — Phase 4C checkout integration

- [x] Implemented checkout API schema and handlers with accurate HTTP status code mapping.
- [x] Integrated `publicOrder` query for unauthenticated order confirmation retrieval using secure tokens.
- [x] Created `Checkout` React form with Indonesian address validation, dynamic shipping quotes, and idempotent submission.
- [x] Created `/checkout` and `/order/[publicToken]` storefront pages with `noindex` configurations.
- [x] Unit tests for checkout utilities, ticket sealing/unsealing, and validation.
- [x] End-to-end integration test validating checkout flow, idempotent submissions, and shipping options against the test database.
- [x] [CHECKOUT-IMPLEMENTATION.md](CHECKOUT-IMPLEMENTATION.md) documents security assumptions, ticket lifecycle, and order state machine.
- [x] Implement Phase 4D (reservation expiry and regression tests).

## Phase 4A order domain (historical record)

- [x] Reused transactional order/reservation/snapshot infrastructure; strict normalized request/idempotency handling and active-category availability validation.
- [x] Locked 3-item/Rp100,000 bundle cap: no surcharge, authoritative DB pricing, deterministic allocation and historical compatibility.
- [x] Random 256-bit public order tokens with encrypted retry recovery; migration `0004_order_token_envelope.sql` adds the envelope and new-order discount-only guards.
- [x] Focused verification: 21 pricing/token unit tests + 17 real PostgreSQL order tests passed. Proven overlapping stock contention: 1 success, 1 `PRODUCT_UNAVAILABLE`, 1 reservation. Typecheck, changed-file lint and migration check passed.
- [x] Concise domain documentation: [ORDER-DOMAIN.md](ORDER-DOMAIN.md).
- [ ] Production migration/release and Phase 4B checkout/quote integration — not performed or begun.

Phase 4A resolves the previous price-increase policy question: bundles must never increase the normal total. Existing campaign targeting/ordering and trusted-quote schema remain; no shipping provider, checkout UI, payment proof or cron is added. Historical phase records below describe their original scope. No full browser suite, unrelated feature tests, production build or visual QA was run for this subphase, as requested.

## Phase 3.5 operational recovery

The Phase 3 audit correctly identified absent Phase 2 tooling. This recovery implements that missing capability on the existing architecture. See [ADMIN-PRODUCT-IMPLEMENTATION.md](ADMIN-PRODUCT-IMPLEMENTATION.md) and [MEDIA-PIPELINE.md](MEDIA-PIPELINE.md).

- [x] Protected admin shell, actual catalog dashboard, product search/filter/pagination and category management.
- [x] Transactional product editor: information, integer prices, flexible measurements, condition/defects, existing promotion eligibility and SEO.
- [x] Explicit draft/publish/archive actions, private preview, optimistic revisions and commerce-state protection.
- [x] Signed direct private-source upload; actual byte validation, Sharp optimization and three persisted WebP variants.
- [x] Bounded multi-file upload/progress/retry, alt/defect edits, family reorder, durable removal and cleanup retry.
- [x] Existing server RBAC/audit reuse and scoped storefront cache invalidation.
- [x] Migration 0003 adds media ingestion/removal plans and image family representation without replacing catalog tables.
- [x] Real PostgreSQL integration tests include provider failures, permissions, bundle repricing and commerce-state protection.
- [x] Final browser workflow, visual inspection and validation gates passed; record below.
- [ ] Production migration/bootstrap, deployment, R2 CORS/domain/lifecycle setup and genuine-media smoke test.
- [ ] Phase 4 checkout/shipping/order workflow — not begun.

Existing local secrets are not printed or used by test databases/storage. This recovery does not apply production migrations or deploy. Previous phase verification records below are historical; live deployment status must not be inferred from them.

### Phase 3.5 verification — 2026-10-07

- `npm run typecheck` and `npm run lint`: passed with no TypeScript/ESLint errors.
- `npm run format:check`: passed.
- `npm test`: **45 tests passed** across 9 files, including real Sharp output validation, same-origin HTTP protection and committed-removal/failed-cleanup response handling.
- `npm run test:integration`: **36 tests passed** across 4 files against isolated PostgreSQL, including the prior auth/order/inventory/storefront suite and 10 admin/media integration tests. Fresh migrations 0000–0003 applied successfully; teardown waits for database connections to close.
- `npm run db:check`: passed. `npm run db:generate`: **31 tables, no schema changes**; migration snapshot matches schema.
- `npm run build`: passed with all public and admin routes compiled.
- `npm run test:e2e`: **19 tests passed** (16 existing storefront/foundation + 3 admin). After the final measurement-entry/preview and category slug/refresh adjustments, the production build and all **3 admin tests passed again**.
- Browser workflow uses real Auth.js credentials/session, PostgreSQL services, signed upload authorization and Sharp; only object-provider I/O is redirected to a loopback test store. It verifies draft privacy/noindex, create/upload/reorder/preview/publish, public price/metadata/media changes after cache invalidation, archive, category edits and forbidden Order Operator HTTP mutations.
- Visual QA inspected desktop/mobile product tables, create/edit forms, uploader/ordering, condition/measurements/eligibility/SEO, preview and public result. Admin screenshots cover 390/768/1440px; editor Axe checks report zero violations. Existing public tests cover 360/390/768/1366/1440px.

Tests need permission to start local loopback PostgreSQL/HTTP servers; the initial sandbox-only attempt was blocked by EPERM and was rerun successfully with that permission. No test used the configured production Neon or R2 resources. Production CORS, actual R2 reads/writes, deployment and genuine-catalog delivery have **not** been verified by this phase.

Remaining operating limits: cleanup is operator-triggered with durable retries (no scheduled worker), category choices cap at 500, and changed slugs do not create redirects. These are explicit boundaries, not missing product-editor placeholders. Next implementation scope is **Phase 4 — Checkout + Shipping Rates + Transactional Order Creation + Inventory Reservation + Final Server-Side Pricing**; it has not begun.

## Phase 3 record — storefront (superseded by Phase 3.5 recovery above)

The user's Phase 3 scope supersedes the original roadmap numbering. Existing Phase 0/1A architecture is preserved. Repository inspection found no Phase 2 Admin Product Management or verified R2 variant pipeline; these are explicitly **not** marked complete. See [STOREFRONT-IMPLEMENTATION.md](STOREFRONT-IMPLEMENTATION.md) for implementation boundaries and launch prerequisites.

- [x] Compact public shell, mobile navigation, configured homepage banner/fallback and new arrivals.
- [x] Bounded catalog/category queries, search, filters, sorting, pagination and shareable URLs.
- [x] Product details, gallery, condition/defects, actual measurements, sold pages and related products.
- [x] Approved-only paginated reviews and legitimate verified-purchase indicators.
- [x] Persistent guest cart; add/remove/clear, live availability, centralized server pricing and explicit unavailable lines.
- [x] Promotion visibility limited to cart pricing; existing eligibility, grouping strategies and price policies retained.
- [x] Metadata, canonical URLs, product/breadcrumb JSON-LD, sitemap batches and robots policy.
- [x] Typed privacy-limited analytics abstraction; vendor delivery remains disabled/unimplemented.
- [x] Responsive layouts, keyboard dialogs/gallery, loading/empty/error states and browser QA harness with isolated fixtures.
- [x] Implementation/runbook and roadmap documentation.
- [x] Prior prerequisite recovered in Phase 3.5: Admin Product Management + Cloudflare R2 media/variant pipeline; live provider verification remains a deployment gate.
- [ ] Production migration/bootstrap, genuine catalog/media, storefront deployment and live R2 delivery verification.
- [ ] Phase 4 checkout/shipping integration; not begun in this task.

Validation record: see the final Phase 3 verification record below. Unit/integration/browser tests use isolated fixtures, never the configured production Neon database. Visual QA images are marked TEST and never become production content.

Open business decisions remain campaign allocation strategy/price policy before activation, shipping and reservation policies, review intake, retention, and analytics consent/vendor configuration. No active promotion, shipping rate, real bank detail or customer review was invented.

## Phase 3 verification record — 2026-10-07

- TypeScript typecheck, zero-warning ESLint, formatting and Drizzle migration metadata check: passed.
- Unit tests: **40 passed** across six files, including bundle counts 1–9, interleaved/noneligible items, query normalization, cart persistence parsing and safe JSON-LD.
- Real PostgreSQL integration tests: **26 passed** across three files. Existing authentication/RBAC, inventory/order/payment invariants remain green; new catalog/cart tests exercise actual SQL and centralized pricing.
- Production build: passed. Builds do not connect to the production database; public data is fetched at runtime through explicit caches.
- Playwright: **16 passed** against the production build and isolated PostgreSQL/Neon-protocol proxy. No browser JavaScript exceptions in storefront tests. All five requested viewport sizes passed overflow and automated accessibility checks on catalog, category, active/sold detail and a six-item cart; the existing home/admin checks also passed.
- Browser coverage includes gallery keyboard selection, visible defects/measurements, public-only reviews, mobile menu/filter focus, pagination, search, persisted cart add/remove, mixed and multiple bundles, unavailable/private entries, SEO/sitemap privacy, pricing retry and media failure before hydration.
- Visual screenshots inspected: mobile detail and populated cart, desktop catalog. Test media is explicitly marked TEST; real production photography and live R2 delivery are not implied.
- Fixed findings: catalog heading hierarchy; stale asynchronous pricing response protection; missing image fallback when failure occurs before hydration; automatic product-detail prefetch disabled to avoid unnecessary background catalog queries.
- No new application tables or migrations were required. Existing schema and pricing algorithm were preserved.
- Not performed: production migration/bootstrap, staff activation, deployment, live product-media upload/variant verification or shipping/payment integrations. Existing Phase 0 deployment remains the published state.

## Phase 1A delivery record

Phase 0 architecture is retained. Phase 1A implements all required database domains, migrations/guards, credentials authentication, database-backed permissions, bootstrap, operator lifecycle, audits, transactional orders/reservations/payments, reviews, settings and configurable bundle pricing. See [Database](DATABASE-IMPLEMENTATION.md), [Auth/RBAC](AUTH-RBAC.md), [Bootstrap](ADMIN-BOOTSTRAP.md) and [Promotions](PROMOTIONAL-PRICING.md).

- [x] 29-table schema, generated migrations and custom PostgreSQL invariant guards.
- [x] Staff authentication, distributed login limits, live permission checks/session revocation.
- [x] Safe explicit Owner bootstrap; default roles; operator lockout protection and audits.
- [x] Server-calculated order snapshots, transaction-safe stock, reservation release and controlled order/payment transitions.
- [x] Approved public reviews; SEO/bank/settings service foundations.
- [x] Bundle calculations and immutable allocations; active campaigns require explicit business choices.
- [x] Development-only access-control seed; real PostgreSQL and Auth.js integration tests.
- [x] Operational documentation.
- [ ] Production migration, real Owner bootstrap, AUTH_ENABLED activation and backend release (not performed in this task).
- [ ] Admin Product Management + Cloudflare R2 Media Pipeline remains missing (Phase 3 inspection confirmed).
- [x] Storefront through cart implemented in Phase 3.
- [ ] Checkout/payment upload UI, shipping integration and complete admin UI.

Validation: 34 unit tests, 22 integration tests and six production-build browser tests passed. Typecheck, zero-warning lint, formatting, Drizzle metadata checks and production build passed. Browser coverage preserves the disabled-auth prelaunch behavior across five viewport sizes; actual enabled authentication is exercised separately through Auth.js integration tests. Integration tests apply all migrations to disposable PostgreSQL, not the live Neon database.

Current open decisions: promotion grouping/price policy; business reservation TTL and submitted-proof escalation; shipping/origin configuration; real bank/WhatsApp/legal content; review intake/duplication policy; upload acceptance and retention; password recovery transport. Credentials authentication, Owner bootstrap, permission defaults and database login throttling are implemented decisions, no longer open questions.

## Historical Phase 0 assessment

The assessment below records the original Phase 0 scope and findings, not the current completion status. Subsequent Phase 0 deployment/configuration is recorded in DEPLOYMENT.md; Phase 1A supersedes its authentication/database limitations.

## Scope and source of truth

The requested first delivery is assessment plus **Phase 0 only**. Read all 25 numbered specifications and both AGENTS.md files before implementation. The source pack is actually in `documents/`, not `docs/`; retain it intact. This plan lives at the explicitly requested path. Root AGENTS.md takes precedence. No commerce features are represented as complete by the foundation.

## 1. Current repository assessment

- Initial state: root AGENTS.md, documents/ specification pack, and a macOS metadata file. No application, dependencies, reusable components, database, tests, deployment configuration, or Git repository.
- Local runtime: Node 22.22.0 and npm 10.9.4. Use npm and a committed lockfile for reproducible installs.
- No existing implementation conflicts. The docs path mismatch is administrative, not a blocker.
- Credentials and real store content have not been supplied. Builds must work without them; operations requiring providers must fail explicitly and safely.

## 2. Proposed folder structure

```text
documents/                       authoritative source specifications
docs/                            assessment, operational setup and decisions
drizzle/                         generated, reviewed SQL migrations
src/
  app/                           App Router layouts, pages, handlers
    admin/login/                 disabled login/configuration state initially
    admin/(protected)/           server-authorized operations in later phases
    api/auth/[...nextauth]/       Auth.js boundary
  components/                    shared presentation primitives
  features/                      catalog, checkout, orders, payments, shipping,
                                 reviews, seo, admin (as slices land)
  server/
    auth/                        Auth.js configuration, permission guards
    db/                          Neon connection and Drizzle schema
    repositories/                bounded data access
    services/                    transactional application operations
    storage/                     public media/private proof R2 adapter
  lib/                           validated configuration and safe domain errors
  styles/                        semantic design tokens and global styles
tests/                           unit and integration boundaries
e2e/                             browser checks
```

Create directories as they gain real implementations, not empty placeholder modules.

## 3. Database implementation sequence

Phase 0: Drizzle config, lazy Neon connection supporting interactive transactions, identity/role/permission tables and initial migration. No fabricated users or grants. Phase 1: categories, products, measurements, image metadata and reviews; constraints and indexes described in documents/08. Phase 2: customers, addresses, orders, immutable items, status history, authoritative quote records and reservation mechanism. Phase 3: banks/payments. Phase 4: shipments. Phases 5–6: audit/operator lifecycle, store/SEO settings and banners. Audit tables must arrive with the first sensitive write, regardless of phase numbering. Money is integer IDR, timestamps are UTC. Generate/review migrations; run once against the correct environment, never automatically during builds.

## 4. Authentication and RBAC

Auth.js for staff only. Phase 0 supplies a disabled provider skeleton, safe route configuration response and a database-backed authorization boundary. No public signup, fake session, seeded password or email-based auto-promotion. Resolve current active user and permission grants from the database on each privileged operation, so revocation does not wait for token expiry. Identity method and first-owner provisioning require a decision before enabling login. Add distributed login throttling with that slice. Phase 5 delivers invitations, roles, deactivation, last-owner protection and audit trails; permission checks must already protect earlier admin slices.

## 5. R2/media

Separate public media and private proof buckets; reject equal bucket names. Server-only S3-compatible adapter with random keys, expiring signed upload/download operations, metadata inspection and normalized failures. No public proof URL function. No public upload route in Phase 0. Later upload orchestration must authorize before signing, enforce size/MIME and inspect actual bytes before acceptance, quarantine pending files, create responsive variants, strip metadata, and clean abandoned uploads. Product images go directly through R2/CDN, not database or a mandatory Next image proxy.

## 6. Storefront

Phase 0: mobile-first, noindex prelaunch shell and truthful unavailable state; semantic neutral tokens and accessible navigation. No fake catalog, hero images, testimonials or brand claims. Phase 1: bounded catalog/filter queries, product cards, detailed sizing/defects, accessible gallery, sold pages, related available items and real approved reviews. Loading/error/empty states accompany each data screen.

## 7. Admin

Phase 0: login unavailable state and protected entry that fails closed. Subsequent slices add meaningful database counts, product/category/media editors, orders, dedicated payment queue, moderation, operators, SEO/content and store settings. Check permissions in every service/handler; UI visibility is supplementary. Audit sensitive actions. Avoid fictitious charts.

## 8. Checkout/orders

No customer account. Server validates customer/address, authoritative prices and a valid shipping quote. Use an interactive PostgreSQL transaction and consistent row-lock ordering for stock checks, immutable snapshots, reservation and payment creation. Add idempotency keys and uniqueness constraints for retries. Test two concurrent purchases of quantity one. Reservation expiry is idempotent and uses a business-configured TTL. Centralize documented order transitions; never expose an unrestricted status dropdown.

## 9. Payments

Manual transfer only. Bank details come from stored settings. Authorized direct uploads target the private bucket; completion verifies object metadata and signature before changing only to submitted. Verification/rejection is permission-checked, transactional, idempotent and audited. Rejection requires a reason. Short-lived proof access requires payment permission. WhatsApp links contain only safe order reference and submission text.

## 10. Shipping adapter

Implement normalized destination/rate/tracking types in Phase 2, then connect the selected provider. Missing configuration and provider failures are explicit; never invent rates. Server computes package weight and validates quote ownership/expiry. Manual rates are only possible after explicit owner configuration. Carrier tracking remains optional and clearly distinguished from internal order status.

## 11. Tracking

Guest lookup uses order number plus verification or a high-entropy capability token. Hash stored capability tokens where possible, exclude tokens from logs/analytics/referrers, return a narrow safe DTO and use uniform lookup failures plus distributed throttling. Payment proof and full address never appear in public tracking. Provider tracking is supplemental.

## 12. Reviews

Database records, rating constraint 1–5, pending/approved/rejected moderation. Public queries and rating aggregation filter approved records only. Verify purchase through eligible order items, not merely a nullable order ID. Decide submission eligibility and intake channel before creating public review endpoints. No fixture reviews in production.

## 13. SEO

Foundation stays noindex until real content and launch configuration exist. Later use Metadata API, global/product/category overrides and factual fallbacks, canonical URLs, bounded sitemap generation, robots, breadcrumbs, Open Graph and valid Product schema. Retain sold URLs. No invented ratings, brand, availability or pricing. Prevent faceted index expansion and never index admin/private order routes.

## 14. Analytics readiness

Phase 7: centralized typed event union for the documented eight events; explicit allowed payload fields, no PII or capability tokens. Environment-based vendor activation. Purchase definition needs business agreement (recommended: verified payment) and durable deduplication/outbox handling. No pretend analytics in Phase 0.

## 15. Testing strategy

Phase 0 gates: strict typecheck, ESLint, formatting, unit tests for environment validation, safe errors, permission denial and storage boundaries, production build, browser smoke/accessibility/layout checks at 360, 390, 768, 1366 and 1440 widths. No live integration claim without providers. Future gates include real PostgreSQL concurrency/rollback tests, signed-upload acceptance and authorization tests, session revocation, moderation integrity, and end-to-end customer/operator flows. Keep fixtures isolated to test environments. Check keyboard focus and mobile overflow. Add performance measurements once real media/catalog are available.

## 16. Deployment strategy

Initialize version control; use Vercel previews and separate environment resources. Install with npm ci, run checks, review SQL, apply migrations through one release job, then deploy compatible code. Validate a Neon/R2 smoke test in preview before production. Do not mutate remote providers during foundation setup. Document backup export/restore rehearsal, observability, quotas and rollback before launch. Expiry jobs and multi-instance rate limiting must be deployed with checkout/auth, not left to the final phase.

## 17. Risks

- One-off inventory needs concurrency tests, not just sequential unit tests.
- Proof-submitted orders versus expiry, rejected proofs, refunds and restocking remain business decisions.
- Signed PUT metadata is not content validation; completion workflow must inspect actual objects.
- Missing provider credentials prevent live integration verification.
- Auth.js App Router integration may use a prerelease: lock exact version and reassess before enabling authentication.
- Free tiers have variable quotas; verify selected plans at deployment, never promise perpetual zero cost.
- Neutral foundation styling is provisional until real brand assets/content arrive.

## 18. Dependencies

Next/React/TypeScript; Tailwind/PostCSS; Zod at trust boundaries; Drizzle + Neon serverless WebSocket transport for interactive transactions; Auth.js; AWS S3 client/presigner for R2; ESLint/Prettier/Vitest/Playwright for quality. Add React Hook Form only when complex forms need it and shadcn primitives only when the UI needs them. Avoid installing speculative analytics/shipping/UI packages.

## 19. External credentials/services required

Neon connection and migration access; strong Auth secret and chosen identity provider or credential/invitation transport; Cloudflare account, scoped R2 credentials, separate buckets, CORS and public media domain; canonical app URL; shipping provider key/origin/destination data; Vercel project and scheduled-job support; distributed throttling backing service; optional GA4/GTM IDs. Store bank accounts, WhatsApp, business content and policies belong in application settings, not environment secrets or hardcoded components.

## 20. Recommended phases

0. Foundation (only implementation authorized by this request).
1. Catalog vertical slice, including early authenticated admin/RBAC and audit prerequisites.
2. Checkout, provider adapter, transaction-safe reservation and order operations.
3. Manual payment/proof/verification and WhatsApp CTA.
4. Shipping operations and safe guest tracking.
5. Complete operator lifecycle and administration (Phase 5A-5D done).
6. Editable content and technical SEO. (PENDING)
7. Typed analytics and conversion deduplication (Phase 5D GA4/Ads implemented, outbox integrated).
8. Integrated security, accessibility, performance and operational launch gates.

## Open Decisions

### Blocking later features or launch (not Phase 0)

- Staff authentication method, invitation/reset delivery, first-owner provisioning and session policy.
- Reservation TTL, expiry of submitted proofs, rejected-proof deadlines, cancellation/refund/restock rules, and completion policy.
- Shipping provider, dispatch origin, package weight/dimensions (missing in product schema), supported destinations and manual-shipping policy.
- Store identity/assets/content, bank details, WhatsApp, legal policies, proof/customer retention and deletion rules.
- Review intake, eligible purchase status and duplicate-review policy.
- Single-item Buy Now versus multi-item cart; docs mention cart context but do not specify cart UX.
- Permissions matrix details, verified-payment purchase definition, throttling provider/limits.
- Direct upload acceptance/scanning strategy and final file size/type policy, especially PDFs.

### Safe provisional foundation defaults

- npm, Node 22, strict TypeScript, src/ structure, neutral semantic tokens, system fonts and 4px spacing.
- Indonesian prelaunch interface; IDR domain money and UTC storage per specification. Final content needs owner review.
- Missing provider configuration disables the affected operation; no network work on module import or during static builds.
- Private proof signed access lifetime: short fixed technical limit; no business retention policy inferred.
- Keep source docs in documents/ and engineering plan/runbooks in docs/.

## Delivery status

Assessment and Phase 0 implementation delivered. No later-phase commerce features were implemented. Local Git repository initialized on main; no commit, remote, deployment or live migration was made.

### Verification record — 2026-10-07

- Clean `npm ci`: passed; package versions and lockfile recorded.
- Strict typecheck, zero-warning ESLint, Prettier check: passed.
- Unit tests: 14 passed (configuration/secrets, errors, authorization/revocation, private/public storage and signing).
- Drizzle migration metadata check: passed; regeneration found no schema changes.
- Production build: passed without configured external services. Turbopack required local socket permission outside the execution sandbox.
- Browser suite: 6 passed against the production build, including 360×800, 390×844, 768×1024, 1366×768 and 1440×900. Home and staff screen automated accessibility checks found no violations; no horizontal overflow. Keyboard skip link, protected entry redirect, auth 503/no-store and unknown-route 404 passed. Mobile and desktop home screenshots visually inspected.
- Production dependency audit: zero reported vulnerabilities.
- Full development-tool audit: **not clean**; nine reported affected-package advisories (four moderate via Drizzle Kit/esbuild, five high via Next lint/glob/braces). See FOUNDATION.md. ESLint 9 remains necessary for the current plugin peer ranges; Auth.js is a pinned beta. These are outstanding maintenance risks, not suppressed checks.
- Not verified: live Neon migration/connectivity/transactions, live R2 signing/permissions/CORS, working staff identity provider, Vercel deployment, remote CI execution and any future commerce flow. No credentials were supplied; no fake successful integration was substituted.

### Phase 5B Completed

WhatsApp Order Confirmation has been completed and verified.
