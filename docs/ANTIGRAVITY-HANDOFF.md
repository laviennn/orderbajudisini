# Antigravity Handoff: Repository State & Phase 4 Audit

## Repository State

The repository is on branch `main` with 1 commit ([`ff7631d`](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com) - initial commit).
The previous coding agent (Codex) fully implemented and documented **Phase 4A (Order Domain)** and **Phase 4B (Shipping Abstraction)**, and was in the middle of **Phase 4C (Checkout UI & Order View)** when it ran out of quota.

Current working directory status:

- **16 modified files** (uncommitted changes from Phase 4A, 4B, and the start of 4C).
- **15 untracked files** (Phase 4A/4B migrations, domain docs, services, unit and integration tests, plus Phase 4C checkout service and route).
- **3 empty directories** created for Phase 4C:
  - `src/app/(storefront)/checkout` (empty — no `page.tsx` or layout)
  - `src/app/(storefront)/order/[publicToken]` (empty — no `page.tsx` or layout)
  - `src/features/checkout` (empty — no components)

Lightweight quality checks run:

- `npm run typecheck`: **PASSED** (all TypeScript types valid).
- `npm run lint`: **PASSED** (ESLint 0 warnings, 0 errors).
- `npm run db:check`: **PASSED** (Drizzle schema and migrations 0000–0005 are in sync).
- Focused unit tests: **28 passed** across [tests/order-tokens.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/order-tokens.test.ts), [tests/pricing.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/pricing.test.ts), and [tests/shipping.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/shipping.test.ts).
- Focused PostgreSQL integration tests: **48 passed** across [tests/integration/order-domain.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/integration/order-domain.test.ts) (17/17), [tests/integration/shipping.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/integration/shipping.test.ts) (8/8), [tests/integration/foundation.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/integration/foundation.test.ts) (19/19), and [tests/integration/storefront.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/integration/storefront.test.ts) (4/4).

---

## Phase 4A Status

**Status: COMPLETE & VERIFIED** (Uncommitted in working tree)

All Phase 4A deliverables are implemented and verified against PostgreSQL:

1. **Authoritative pricing & bundle cap**:
   - Locked 3-item / Rp100,000 bundle terms and discount-only pricing policy implemented in [pricing.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/lib/domain/pricing.ts#L3-L7) via [bundleTerms](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/lib/domain/pricing.ts#L3) and [calculateCartPricing](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/lib/domain/pricing.ts#L110). Complete bundle groups never increase normal price.
   - Database boundary check in [0004_order_token_envelope.sql](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/drizzle/0004_order_token_envelope.sql) rejects new surcharges.
2. **Order transaction & inventory reservation**:
   - [createReservedOrder](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/orders.ts#L89) in [orders.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/orders.ts): single PostgreSQL interactive transaction, locks promotion lock `73102`, locks products `FOR UPDATE` in sorted UUID order, verifies active status, category availability, and stock.
   - Atomically creates pending payment, immutable snapshots ([orderItems](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/db/schema/commerce.ts#L198), [orderPromotions](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/db/schema/commerce.ts#L248)), reservations ([inventoryReservations](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/db/schema/commerce.ts#L313)), and order status history ([orderStatusHistory](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/db/schema/commerce.ts#L358)).
   - Concurrency tested: 2 competing transactions for 1 inventory item produce 1 success and 1 `PRODUCT_UNAVAILABLE`.
3. **Idempotency & public order token**:
   - `idempotencyKey` advisory transaction lock, duplicate check, and `requestHash` verification.
   - Random 256-bit order capability token encrypted into [orders.public_token_ciphertext](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/db/schema/commerce.ts#L125) via AES-256-GCM ([createOrderToken](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/order-tokens.ts#L17) / [recoverOrderToken](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/order-tokens.ts#L28)). Token SHA-256 hash stored in `orders.public_token_hash`.
4. **Documentation**:
   - Full documentation written in [docs/ORDER-DOMAIN.md](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/docs/ORDER-DOMAIN.md).

---

## Phase 4B Status

**Status: COMPLETE & VERIFIED** (Uncommitted in working tree)

All Phase 4B deliverables are implemented and verified:

1. **Shipping provider abstraction**:
   - Normalized contracts in [contract.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/shipping/contract.ts): [destinationSchema](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/shipping/contract.ts#L2), [rateSchema](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/shipping/contract.ts#L19), and [ShippingProvider](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/shipping/contract.ts#L31).
   - Rate quoting in [provider.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/shipping/provider.ts) with bounded timeout (5s AbortSignal), 50 service limit, and safe domain errors.
   - Production fails closed: throws `SHIPPING_NOT_CONFIGURED` without a real adapter. Deterministic `TEST` provider only allowed when `NODE_ENV !== "production"`.
2. **Quote validation & server authority**:
   - [createShippingQuotes](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/shipping-quotes.ts#L120) in [shipping-quotes.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/shipping-quotes.ts): loads origin and address under lock, performs provider I/O outside lock, re-verifies fingerprints before persisting to `shipping_quotes` with 5-minute database expiry.
   - Weight calculated strictly server-side ([shippingWeight](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/shipping/context.ts#L41)).
   - [createReservedOrder](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/orders.ts#L89) locks `shipping_quotes` row `FOR UPDATE`, checks ownership, expiry, provider, and context fingerprint. Client cannot control or inject shipping prices.
3. **Migration & Settings**:
   - Migration [0005_shipping_quote_context.sql](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/drizzle/0005_shipping_quote_context.sql) adds `store_settings.shipping_origin` and `shipping_quotes` context columns.
4. **Documentation**:
   - Full documentation written in [docs/SHIPPING-IMPLEMENTATION.md](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/docs/SHIPPING-IMPLEMENTATION.md).

---

## Phase 4C Matrix

| Requirement                           | Status      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Remaining Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/checkout` Route                     | **MISSING** | Directory [src/app/(storefront)/checkout](<file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/app/(storefront)/checkout>) is completely empty. Cart link in [Cart.tsx](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/features/cart/Cart.tsx#L176) points to `/checkout`, which currently 404s.                                                                                                                                                                    | Implement [page.tsx](<file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/app/(storefront)/checkout/page.tsx>) with empty cart redirect, loading skeleton, error boundary, and checkout client container.                                                                                                                                                                                                                                                                                                                                       |
| Customer Information                  | **PARTIAL** | Server validation exists in [checkout.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L23-L29) (`name`, `phone`, `recipientName`). Phone normalization in [normalizePhone](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L16).                                                                                                                                                                     | 1. Add optional `email` field to checkout schema per [12-CHECKOUT-ORDERS.md](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/documents/12-CHECKOUT-ORDERS.md).<br>2. Build client form inputs for name, WhatsApp/phone, email, recipient name with "Sama dengan nama pemesan" toggle.                                                                                                                                                                                                                                                           |
| Indonesian Shipping Address           | **PARTIAL** | Server schema in [checkout.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L27-L28) inherits [destinationSchema](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/shipping/contract.ts#L2) (`addressLine`, `province`, `city`, `district`, `subdistrict`, `postalCode`). Saved to `addresses` table in [prepareCheckout](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L61-L67). | 1. Implement address inputs in checkout form.<br>2. Handle destination matching or provider destination search if applicable.<br>3. Validate Indonesian 5-digit postal code on client.                                                                                                                                                                                                                                                                                                                                                                  |
| Shipping Quote Selection              | **PARTIAL** | [prepareCheckout](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L52) calls [createShippingQuotes](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/shipping-quotes.ts#L120) and returns AES-256-GCM encrypted quote choice references.                                                                                                                                                                              | 1. Implement shipping option radio list showing courier name, service, estimate (ETD), and formatted IDR cost.<br>2. Handle quote fetching state (loading spinner/skeleton) and error state when origin is unconfigured or no services available.<br>3. Handle quote expiry timer/refresh prompt.                                                                                                                                                                                                                                                       |
| Authoritative Checkout Summary        | **PARTIAL** | [prepareCheckout](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L52) returns authoritative `cart` pricing and calculated option totals. Client cannot modify monetary values.                                                                                                                                                                                                                                                                  | Build checkout summary sidebar/card displaying item list, subtotal, promotional discount/bundle breakdowns, selected shipping rate, and final grand total.                                                                                                                                                                                                                                                                                                                                                                                              |
| Order Submission via Phase 4A Service | **PARTIAL** | [submitCheckout](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L78) decrypts reference and calls [createReservedOrder](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/orders.ts#L89) with expected merchandise total. Exposed at [POST /api/checkout](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/app/api/checkout/route.ts#L10).                                                                 | 1. Build submit button with loading state, error display, and redirect to `/order/[publicToken]`.<br>2. Clear ordered items from cart via [removeOrdered](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/features/cart/store.ts#L87).<br>3. Fix HTTP status mapping in [route.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/app/api/checkout/route.ts#L11) (currently maps all domain errors to 503 instead of 400/409/429).                                                                                             |
| Idempotent Submission                 | **PARTIAL** | A unique `idempotencyKey` is generated inside [prepareCheckout](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L70) and sealed into the choice `reference` ticket. Phase 4A advisory lock and request hash prevent duplicate orders.                                                                                                                                                                                                            | 1. Add client-side in-flight double-submit lock.<br>2. Gracefully handle retry of same ticket returning identical order token without re-reserving.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/order/[publicToken]` Route          | **PARTIAL** | Read query [publicOrder](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L87) fetches sanitized order data by SHA-256 token hash. But directory [src/app/(storefront)/order/[publicToken]](<file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/app/(storefront)/order/[publicToken]>) is empty.                                                                                                                                         | 1. Implement Server Component [page.tsx](<file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/app/(storefront)/order/[publicToken]/page.tsx>) that invokes [publicOrder](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L87).<br>2. Add 404 handling if token is invalid or not found.<br>3. Return shipping details (courier, service) in [publicOrder](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L87) so the customer sees where/how order is shipped. |
| Bank-Transfer Instruction Foundation  | **PARTIAL** | [publicOrder](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L94) joins active bank account (`bankName`, `accountNumber`, `accountHolder`) and retrieves `paymentDueAt`.                                                                                                                                                                                                                                                                        | 1. Render clear transfer instructions with bank details.<br>2. Add copy-to-clipboard for account number and total amount.<br>3. Render formatted deadline and countdown badge.<br>4. Explain manual verification process without implementing proof upload (strictly Phase 5).                                                                                                                                                                                                                                                                          |
| Checkout & Order Noindex              | **PARTIAL** | `/checkout` and `/order/` are disallowed in [robots.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/app/robots.ts#L12-L13).                                                                                                                                                                                                                                                                                                                                              | Export `metadata = { robots: { index: false, follow: false } }` on both `/checkout/page.tsx` and `/order/[publicToken]/page.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Analytics Events                      | **PARTIAL** | `begin_checkout`, `add_shipping_info`, and `order_created` added to `CommerceEvent` type in [analytics.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/lib/analytics.ts#L8-L10).                                                                                                                                                                                                                                                                                         | Dispatch `trackCommerce` for:<br>1. `begin_checkout` when viewing checkout page.<br>2. `add_shipping_info` when quote is selected.<br>3. `order_created` on order completion.<br>(GA purchase event must remain omitted).                                                                                                                                                                                                                                                                                                                               |
| Mobile/Responsive Checkout            | **MISSING** | No checkout UI exists; [src/features/checkout](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/features/checkout) is empty.                                                                                                                                                                                                                                                                                                                                                  | Build single-column mobile-first checkout layout (360–430px) expanding to two-column desktop layout using existing semantic tokens in [globals.css](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/styles/globals.css).                                                                                                                                                                                                                                                                                                                    |

---

## Uncommitted / Interrupted Work

Codex performed Phase 4A and 4B and partially initiated Phase 4C without committing. Specifically:

1. **Uncommitted Phase 4A & 4B Core Foundations**:
   - [drizzle/0004_order_token_envelope.sql](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/drizzle/0004_order_token_envelope.sql) & [drizzle/0005_shipping_quote_context.sql](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/drizzle/0005_shipping_quote_context.sql) (untracked migrations).
   - [src/server/services/order-tokens.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/order-tokens.ts) (untracked AES-256-GCM capability encryption).
   - [src/server/shipping/](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/shipping) ([contract.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/shipping/contract.ts), [context.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/shipping/context.ts), [provider.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/shipping/provider.ts)) (untracked shipping provider system).
   - [src/server/services/shipping-quotes.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/shipping-quotes.ts) (untracked shipping quote service).
   - Modifications in [orders.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/orders.ts), [pricing.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/lib/domain/pricing.ts), [commerce.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/db/schema/commerce.ts), [configuration.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/db/schema/configuration.ts), [settings.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/settings.ts).
   - Tests: [tests/order-tokens.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/order-tokens.test.ts), [tests/shipping.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/shipping.test.ts), [tests/integration/order-domain.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/integration/order-domain.test.ts), [tests/integration/shipping.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/integration/shipping.test.ts).

2. **Uncommitted Interrupted Phase 4C Code**:
   - [src/server/services/checkout.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts) (untracked service with `normalizePhone`, `prepareCheckout`, `submitCheckout`, `publicOrder`).
   - [src/app/api/checkout/route.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/app/api/checkout/route.ts) (untracked API route with IP rate-limiting via `loginRateLimits`).
   - [src/features/cart/Cart.tsx](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/features/cart/Cart.tsx) & [src/features/cart/store.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/features/cart/store.ts) (modified with link to `/checkout` and `removeOrdered`).
   - [src/lib/analytics.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/lib/analytics.ts) (modified type union).
   - Empty folders: `src/app/(storefront)/checkout`, `src/app/(storefront)/order/[publicToken]`, `src/features/checkout`.

---

## Test Coverage

| Test Area                             | Suite Files                                                                                                                              | Status      | Test Count                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------- |
| Phase 4A Pricing Unit                 | [tests/pricing.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/pricing.test.ts)                                   | PASSED      | 20 unit tests                                   |
| Phase 4A Order Tokens Unit            | [tests/order-tokens.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/order-tokens.test.ts)                         | PASSED      | 1 unit test                                     |
| Phase 4A Order Domain Integration     | [tests/integration/order-domain.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/integration/order-domain.test.ts) | PASSED      | 17 PostgreSQL tests (including contention test) |
| Phase 4B Shipping Unit                | [tests/shipping.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/shipping.test.ts)                                 | PASSED      | 7 unit tests                                    |
| Phase 4B Shipping Integration         | [tests/integration/shipping.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/integration/shipping.test.ts)         | PASSED      | 8 PostgreSQL tests                              |
| Foundation Integration (Auth, Orders) | [tests/integration/foundation.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/integration/foundation.test.ts)     | PASSED      | 19 PostgreSQL tests                             |
| Storefront Catalog/Cart Integration   | [tests/integration/storefront.test.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/tests/integration/storefront.test.ts)     | PASSED      | 4 PostgreSQL tests                              |
| **Phase 4C Checkout Tests**           | _None_                                                                                                                                   | **MISSING** | **0 tests exist**                               |

---

## Risks

1. **Broken Storefront Cart Link**:
   - [Cart.tsx](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/features/cart/Cart.tsx#L176) already renders a link to `/checkout`. Clicking it leads to an immediate 404 page because `/checkout/page.tsx` does not exist.
2. **HTTP Status Code Mapping in `/api/checkout`**:
   - [route.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/app/api/checkout/route.ts) delegates error formatting to [adminResponse](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/http/admin.ts#L4). [adminResponse](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/http/admin.ts#L4) defaults any unmapped error code to HTTP 503.
   - When a customer triggers `RATE_LIMITED`, `PRODUCT_UNAVAILABLE`, `SHIPPING_QUOTE_EXPIRED`, or `INVALID_SHIPPING_SELECTION`, the response will be 503 instead of 429, 409, or 400.
3. **Repeated Customer/Address Record Creation**:
   - Each call to [prepareCheckout](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L52) unconditionally inserts a new record into `customers` and `addresses` tables. If a customer edits their address or re-quotes multiple times before submitting, orphan customer/address rows accumulate.
4. **Missing Courier/Shipping Details in `publicOrder`**:
   - [publicOrder](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L87) currently projects `orderNumber`, `status`, `items`, `merchandiseTotal`, `shipping`, `total`, `deadline`, and `bank`. It does not return recipient details or the chosen courier/service name, leaving the order confirmation page unable to show shipping details.
5. **Phase 4D Scope Creep Guard**:
   - The order confirmation page must strictly avoid payment proof upload, payment verification, WhatsApp click-to-chat links with private URLs, or carrier tracking (these belong to Phase 5 / 4D).

---

## Recommended Completion Order

The remaining work for Phase 4C should be executed incrementally:

1. **Step 1: Backend Refinements & Unit Tests**:
   - Add optional `email` and optional customer `notes` to checkout schema in [checkout.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts).
   - Enrich [publicOrder](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L87) to include recipient name, address snippet, courier name, and service name.
   - Fix HTTP status code mapping in [route.ts](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/app/api/checkout/route.ts) for `RATE_LIMITED` (429), `CONFLICT` / `PRODUCT_UNAVAILABLE` (409), and validation errors (400).
   - Write unit test `tests/checkout.test.ts` for [normalizePhone](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/server/services/checkout.ts#L16), ticket sealing/unsealing, and validation schemas.
2. **Step 2: Integration Tests**:
   - Write `tests/integration/checkout.test.ts` verifying `prepareCheckout` -> `submitCheckout` -> `publicOrder` flow against real PostgreSQL, including idempotency on duplicate submission and rejection of expired/tampered tickets.
3. **Step 3: Checkout UI & State Machine**:
   - Build checkout components in [src/features/checkout](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/features/checkout):
     - Customer details form with Indonesian phone validation.
     - Destination address form.
     - Shipping quote selection list with price, courier, and ETD.
     - Authoritative order summary sidebar/card.
     - Submit button with disabled/in-flight states and error toasts/banners.
   - Create [src/app/(storefront)/checkout/page.tsx](<file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/app/(storefront)/checkout/page.tsx>) with empty cart guard and `noindex` metadata.
4. **Step 4: Order Confirmation View**:
   - Create [src/app/(storefront)/order/[publicToken]/page.tsx](<file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/src/app/(storefront)/order/[publicToken]/page.tsx>) with `noindex` metadata.
   - Build bank transfer instruction card (bank name, account number with copy button, account holder, exact total amount).
   - Display payment deadline countdown badge and clear instruction text.
   - Clear purchased items from localStorage cart via `removeOrdered`.
5. **Step 5: Analytics & Quality Gates**:
   - Wire `begin_checkout`, `add_shipping_info`, and `order_created` events via `trackCommerce`.
   - Run typecheck, lint, unit tests, integration tests, and build check.
   - Update [docs/CHECKOUT-IMPLEMENTATION.md](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/docs/CHECKOUT-IMPLEMENTATION.md) and [docs/IMPLEMENTATION-PLAN.md](file:///Users/naoo/P.A.R.A/PROJECTS/orderbajudisini-com/docs/IMPLEMENTATION-PLAN.md).
