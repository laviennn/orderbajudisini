# OrderBajuDisini prelaunch deployment

## Current deployment — 2026-10-07

- Public production URL: https://orderbajudisini-com.vercel.app
- Desired canonical domain: https://orderbajudisini.com
- Vercel project: `laviennns-projects/orderbajudisini-com`.
- Deployment ID: `dpl_AvYZrdnwowQtfnGAHbqtpGVwvpLm` (READY).
- Store name supplied by owner: OrderBajuDisini.
- WhatsApp remains unconfigured: the supplied value was dummy, so no contact link is published.
- Shipping provider, shipping API key and GTM are deferred by the owner.

This is the Phase 0 prelaunch site. Catalog, checkout, operational login, payments and tracking are not enabled. The noindex policy remains in place. No fake products or contact details have been published.

## Configuration handling

The owner originally entered credentials in `.env.example`. They were moved to ignored `.env.local` with file permissions 0600; `.env.example` is now a sanitized template. `.vercelignore` also excludes all `.env*` files from source upload. Following explicit owner approval, nine required variables were transferred through stdin to Vercel Production as Sensitive values. Secrets are not included in this document or command output.

R2 public assets bucket: `orderbajudisini-assets`, media base URL: `https://assets.orderbajudisini.com`.

The successfully verified proof bucket name is **`orderbajudisini-payment-proofs`**, without the additional s after payment. The spelling `orderbajudisini-payments-proofs` returned 404 and is not used. Proof bucket privacy settings still need to remain disabled for both custom domains and the public development URL; authenticated object access does not itself verify public access settings.

## Verification

- Environment schema validation passed after correcting the media URL to HTTPS.
- Live Neon read-only connection succeeded.
- Authenticated read/list access to both R2 buckets succeeded; no object contents or names were printed and no objects were written.
- Local typecheck, lint, 14 unit tests, production build and six browser tests passed.
- Vercel production build completed successfully.
- Anonymous HTTP request to the stable production URL returned 200 with the OrderBajuDisini prelaunch page.
- The deployment-specific Vercel URL uses Vercel authentication protection; share the stable public production URL above instead.
- No database migrations were run in this deployment. The prelaunch page does not depend on application tables.

## Remaining custom-domain step

At verification time, the apex domain was not yet reachable and Vercel requested this Cloudflare DNS record:

| Type | Name | Value       | Proxy    | TTL  |
| ---- | ---- | ----------- | -------- | ---- |
| A    | @    | 76.76.21.21 | DNS only | Auto |

Keep the Cloudflare nameservers and the existing `assets` record. Update an existing conflicting apex A/CNAME record rather than adding contradictory records. After saving, allow DNS and certificate provisioning to finish, then confirm `https://orderbajudisini.com` serves the same prelaunch page.

The user has been sent the DNS instructions; no Cloudflare DNS credentials are available in this workspace. R2 credentials are not DNS-management credentials.
