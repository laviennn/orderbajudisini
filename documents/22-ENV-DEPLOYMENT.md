# Environment & Deployment

## Environments

-   local
-   preview
-   production

Use separate DB/storage prefixes or resources where feasible.

## Example Environment Variables

``` env
DATABASE_URL=
AUTH_SECRET=
APP_URL=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BUCKET=
R2_PRIVATE_BUCKET=
R2_PUBLIC_BASE_URL=

SHIPPING_PROVIDER=
SHIPPING_API_KEY=

NEXT_PUBLIC_GTM_ID=
```

Actual variable names may evolve; document final names in `.env.example`
without secrets.

## Vercel

-   Git-connected deployments
-   preview deployments
-   production env variables configured separately
-   do not expose server secrets
-   monitor free-tier usage

## Migrations

Production deploy procedure must define when migrations run. Avoid
concurrent destructive migrations.

## Backups

Free-tier-first does not remove need for backup strategy. Document Neon
backup/restore capability available to the chosen plan and provide
export procedure before launch.

## Zero-Cost Principle

The project targets no recurring paid subscription at initial scale.
Never claim unlimited free infrastructure. Add usage monitoring and
document upgrade triggers: - DB storage/compute - R2
storage/operations - Vercel bandwidth/functions/image usage - shipping
API quota
