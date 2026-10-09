# Batch D: Deployment Runbook

## Vercel Target Setup
1. Validate Project Settings in Vercel Dashboard for `laviennns-projects/orderbajudisini-com`.
2. Connect to the GitHub repository `laviennn/orderbajudisini`.
3. Set the Root Directory to the project folder (`/` if standard).
4. Framework Preset: Next.js.
5. Disable Vercel Data Cache globally unless strictly opting into Next.js caching manually (the app uses standard App Router).

## Environment Configuration
Apply all environment variables through the Vercel Settings > Environment Variables pane, mapped to `Production`:
- `DATABASE_URL`: Production Neon pooled connection string.
- `AUTH_SECRET`: New cryptographically random string (e.g. via `openssl rand -base64 32`).
- `APP_URL`: `https://orderbajudisini.com`
- `R2_ACCOUNT_ID`: Target Cloudflare R2 Account ID.
- `R2_ACCESS_KEY_ID`: Cloudflare Access Key mapped to appropriate bucket permissions.
- `R2_SECRET_ACCESS_KEY`: Cloudflare Secret Key.
- `R2_PUBLIC_BUCKET`: `orderbajudisini-assets`
- `R2_PRIVATE_BUCKET`: `orderbajudisini-payment-proofs`
- `R2_PUBLIC_BASE_URL`: `https://assets.orderbajudisini.com`
- `SHIPPING_PROVIDER`: Configure with active courier logic API (e.g. `rajaongkir`).
- `SHIPPING_API_KEY`: Production courier key.
- `AUTH_ENABLED`: `true`

## Deployment Execution
1. Push branch `main` to GitHub.
2. Vercel automatically creates a production deployment.
3. Validate build logs for zero errors.

## Post-Deployment Smoke Test
1. Visit `https://orderbajudisini.com`.
2. Observe proper catalog rendering (empty states or active products).
3. Open `https://orderbajudisini.com/admin/login` and verify access using configured Owner credentials.
4. Check that Cloudflare DNS propagates correctly and points `@` A/CNAME to `76.76.21.21` or `cname.vercel-dns.com`.
