# Shipping implementation — Phase 4B

## Boundary and configuration

`src/server/shipping/contract.ts` defines normalized destinations and rates plus `ShippingProvider` (quotes and optional destination search). Application services never consume vendor payloads. `provider.ts` validates normalized results, caps results at 50 services/20 destinations, aborts after five seconds and returns safe domain errors. Actual adapters must honor the abort signal and translate vendor errors.

No real shipping provider/API key was configured at inspection. `shippingConfiguration()` explicitly returns unavailable; `getShippingProvider()` throws `SHIPPING_NOT_CONFIGURED`. Setting an arbitrary provider/key does not pretend an adapter exists.

Only `SHIPPING_PROVIDER=test` with `NODE_ENV=development` or `test` enables deterministic, visibly TEST rates/destinations. Production rejects both this adapter and persisted TEST quotes. `SHIPPING_API_KEY` is reserved for the eventual real adapter, not used by TEST. Automated tests use doubles/local PostgreSQL, never live provider APIs.

## Origin and weight

Migration `0005_shipping_quote_context.sql` adds nullable `store_settings.shipping_origin` JSON: `province`, `city`, `district`, five-digit `postalCode`, optional nullable `subdistrict` and `providerDestinationId`. Set through existing `setStoreSettings` with `settings.manage`; existing audit behavior applies. No settings UI or hardcoded address was added. Missing/invalid origin blocks quotes.

Existing integer `products.weightGrams` and Admin Product weight input are reused unchanged. Missing/nonpositive weight blocks shipping; total weight comes from persisted product weight × validated quantity (maximum 10,000,000 grams). Client-supplied weight/cost is rejected.

## Quote reference and order safety

`createShippingQuotes({customerId,addressId,items})` loads owned address, origin and active available products/categories in a short transaction. Provider I/O runs outside database locks. A second transaction reloads context and rejects changes before persisting rates.

The existing `shipping_quotes` table holds a random UUID reference with a five-minute PostgreSQL-clock expiry. Migration 0005 adds context fingerprint, TEST marker and normalized courier/service display names; its fingerprint check enforces SHA-256 format. No new table is required.

Future checkout sends `shippingQuoteId`, not a cost. `createReservedOrder` locks the quote and rechecks ownership, expiry, configured provider, production TEST restrictions, current origin/address fingerprint and cart quantities/weights inside its existing inventory transaction. Only database quote cost enters order totals. The existing unique order/quote relationship prevents reference reuse across orders; idempotent retry of an already committed order still returns that order. Legacy quotes without a context fingerprint cannot create new orders; historical orders remain intact.

Errors: `INVALID_DESTINATION`, `SHIPPING_NOT_CONFIGURED`, `SHIPPING_PROVIDER_UNAVAILABLE`, `SHIPPING_NO_SERVICES`, `SHIPPING_QUOTE_EXPIRED`, `INVALID_SHIPPING_SELECTION`, `SHIPPING_WEIGHT_INVALID`, `SHIPPING_ORIGIN_INVALID`.

These are internal server services, not public endpoints. Future guest checkout must establish customer/address ownership and rate-limit requests before invoking them. No checkout UI, payment implementation or tracking work is included.

## Migration and validation

Run `npm run db:migrate` against the intended configured database before using this phase. No production migration/deployment was performed. Fresh isolated PostgreSQL successfully applied migrations 0000–0005.

Focused checks: 7 shipping unit tests; 8 PostgreSQL shipping tests (persisted normalization, tampering, invalid/expired/foreign reference, changed origin/address/weight, missing inputs, context mutation during provider I/O and production TEST rejection); 17 order-domain tests plus 7 affected foundation order tests, including concurrent quantity-one reservation (12 unrelated foundation tests intentionally skipped). Typecheck, changed-file ESLint and `npm run db:check` passed. No browser regression was run.

Before production rates: choose a provider, implement its normalized adapter, configure its credentials and supported origin/destination identifiers, fill store origin and product weights, then apply migrations/release. No production rate is invented while those are missing.
