# orderbajudisini.com

Thrift commerce application. **Phase 3 storefront through cart** and Phase 1A backend foundations are implemented locally. Checkout/payment upload UI and full admin operations are not implemented. The assumed Phase 2 Admin Product Management/R2 pipeline was absent from this repository and remains a launch prerequisite.

Authoritative product specifications: [documents/00-README.md](documents/00-README.md). Storefront architecture: [docs/STOREFRONT-IMPLEMENTATION.md](docs/STOREFRONT-IMPLEMENTATION.md). Assessment, sequence and unresolved decisions: [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md). Provider setup and operational limits: [docs/FOUNDATION.md](docs/FOUNDATION.md).

## Local development

Use Node 22 and npm.

```sh
npm ci
# Preserve an existing environment file:
test -f .env.local || cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Browsing requires the existing migrations on the selected database; missing/unavailable data providers show a safe error state. No staff session is required for public browsing. Invalid supplied configuration fails startup without printing secret values. Do not commit `.env.local`.

## Checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:integration
npm run db:check
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests start disposable local PostgreSQL with explicitly marked fixtures and a production server on port 3100; build first. They never use the configured Neon database. Tests cover five viewport sizes, accessibility, catalog/detail/cart flows, pricing, error recovery, keyboard controls, disabled auth routes and SEO. Screenshots are generated under ignored `test-results/`.

## Database

```sh
npm run db:generate
npm run db:check
# Only after reviewing migration SQL and configuring the intended database:
npm run db:migrate
```

The migrations create 29 domain tables and PostgreSQL invariant guards. They create no staff credentials or fake business data. Production migrations never run automatically during development/builds. Integration tests explicitly migrate a disposable local PostgreSQL cluster, never the configured Neon database.

See [database setup](docs/DATABASE-IMPLEMENTATION.md), [authentication/RBAC](docs/AUTH-RBAC.md), [first Owner bootstrap](docs/ADMIN-BOOTSTRAP.md) and [bundle pricing](docs/PROMOTIONAL-PRICING.md). Keep AUTH_ENABLED=false until migrations and bootstrap are complete.
