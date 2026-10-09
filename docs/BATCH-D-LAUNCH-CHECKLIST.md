# Batch D: Launch Checklist

## Pre-Launch Dependencies
- [ ] Vercel Environment Variables populated (`AUTH_SECRET`, `R2_*`, `DATABASE_URL`, `SHIPPING_*`).
- [ ] Neon PostgreSQL Production Database provisioned and URI obtained.
- [ ] Initial Database Migrations successfully applied.
- [ ] Cloudflare R2 Buckets (`orderbajudisini-assets`, `orderbajudisini-payment-proofs`) created with correct visibility and lifecycle policies.
- [ ] Domain DNS mapped to Vercel (apex -> `76.76.21.21`).
- [ ] Shipping Provider API active and tested.
- [ ] Default Owner Account bootstrapped using the environment/seed script.

## Launch Execution
- [ ] Change `AUTH_ENABLED` to `true` in Vercel to lock admin operations.
- [ ] Login as the Owner on the production URL (`https://orderbajudisini.com/admin/login`).
- [ ] Configure Store Settings (WhatsApp number, Origin Address, Currency/Identity).
- [ ] Upload active Merchant Payment Settings (QRIS, Bank details).
- [ ] Remove `noindex` blocks if any exist dynamically in the Storefront metadata settings.

## Immediate Post-Launch
- [ ] Execute an anonymous guest checkout on production with dummy data to verify E2E transactional integrity.
- [ ] Verify Payment Proof Upload hits the private R2 bucket.
- [ ] Confirm order visibility and approval inside the Admin Dashboard.
- [ ] Check Vercel error logs for production anomalies.
