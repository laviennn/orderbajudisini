# Batch D: Launch Checklist

## Pre-Launch Dependencies

- [ ] Vercel Environment Variables populated (`AUTH_SECRET`, `R2_*`, `DATABASE_URL`, `SHIPPING_*`).
- [ ] Neon PostgreSQL Production Database provisioned and URI obtained.
- [ ] Initial Database Migrations successfully applied via `npx drizzle-kit push`.
- [ ] Cloudflare R2 Buckets (`orderbajudisini-assets`, `orderbajudisini-payment-proofs`) created with correct visibility and lifecycle policies.
- [ ] Domain DNS mapped to Vercel (apex -> `76.76.21.21`).
- [ ] Shipping Provider API active and tested.
- [ ] Default Owner Account bootstrapped using the environment/seed script.

## Live Staging / Isolated Verification (Pre-Production)

**DO NOT EXECUTE DUMMY TRANSACTIONS AGAINST THE LIVE PUBLIC STORE.** Ensure the following are run in an isolated Staging Vercel deployment targeting a dedicated Staging Neon Database:

- [ ] Execute an anonymous guest checkout in staging to verify E2E transactional integrity.
- [ ] Verify Payment Proof Upload safely lands in the staging R2 bucket.
- [ ] Confirm order visibility and approval inside the Staging Admin Dashboard.

## Launch Execution

- [ ] Change `AUTH_ENABLED` to `true` in Production Vercel to lock admin operations.
- [ ] Login as the Owner on the production URL (`https://orderbajudisini.com/admin/login`).
- [ ] Configure Store Settings (WhatsApp number, Origin Address, Currency/Identity).
- [ ] Upload active Merchant Payment Settings (QRIS, Bank details).
- [ ] Remove `noindex` blocks from the Storefront metadata settings only upon explicit executive authorization.

## Immediate Post-Launch

- [ ] Check Vercel error logs for production anomalies.
- [ ] **NO DUMMY PRODUCTION TRANSACTIONS.** Any real-world tests on the live store must be fully authorized by operations, using actual payments, and mapped to a documented cleanup procedure for inventory reconciliation.
