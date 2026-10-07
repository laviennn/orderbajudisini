# Phase 0 operational notes (historical)

Phase 1A supersedes the database/authentication sections below. Use [DATABASE-IMPLEMENTATION.md](DATABASE-IMPLEMENTATION.md), [AUTH-RBAC.md](AUTH-RBAC.md) and [ADMIN-BOOTSTRAP.md](ADMIN-BOOTSTRAP.md) for current setup. AUTH_ENABLED now explicitly controls staff login; keep it false until migration/bootstrap. The existing R2 adapter and prelaunch shell remain.

## Implemented boundary

Next.js App Router with TypeScript strict mode, Tailwind semantic tokens, Indonesian prelaunch shell, explicit unavailable staff page, safe loading/error/404 states, noindex metadata and robots. Node 22/npm and exact dependency versions are recorded in package.json/package-lock.json. No remote deployment, live provider connection or business feature is implied.

Infrastructure consists of validated server environment, normalized application errors, a lazy Neon WebSocket pool with Drizzle, generated identity/RBAC migration, disabled Auth.js skeleton, database-backed permission guard, and server-only R2 signing/metadata adapter. UI does not access Drizzle or R2 directly.

## Environment

Copy `.env.example` to `.env.local`. Next loads it for application runtime; Drizzle loads `.env.local` then `.env` without overriding shell variables.

| Variable                                | Purpose                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| APP_URL                                 | Future canonical application origin; local example only, no automatic launch/indexation |
| DATABASE_URL                            | Neon PostgreSQL connection URL; use provider TLS settings                               |
| AUTH_SECRET                             | Random secret of at least 32 characters; by itself does not enable login                |
| R2_ACCOUNT_ID                           | Cloudflare account ID, 32 lowercase hex characters                                      |
| R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY | Server-only scoped R2 credentials                                                       |
| R2_PUBLIC_BUCKET                        | Product media bucket                                                                    |
| R2_PRIVATE_BUCKET                       | Different, private proof bucket                                                         |
| R2_PUBLIC_BASE_URL                      | HTTPS media domain without credentials/query/hash                                       |
| SHIPPING_PROVIDER / SHIPPING_API_KEY    | Reserved for Phase 2, not consumed yet                                                  |
| NEXT_PUBLIC_GTM_ID                      | Reserved for analytics phase, no vendor scripts are loaded                              |

Missing fields result in explicit unavailable operations, not fake success. Malformed values fail validation; diagnostics identify variable names only. Configuration presence is not a connectivity/permission health check. `.env` files and generated artifacts are ignored by Git. Never put DB, Auth, R2 or shipping secrets in `NEXT_PUBLIC_*`.

## Database and migrations

The Neon WebSocket driver supports interactive transactions needed for later stock reservation. This choice follows [Drizzle's Neon documentation](https://orm.drizzle.team/docs/connect-neon). The lazy pool is capped at five connections per application instance; assess total concurrency against provider limits before launch.

Review `drizzle/0000_sleepy_polaris.sql`, set DATABASE_URL for a disposable development/preview database and run `npm run db:migrate`. The schema creates users, roles, permissions and role_permissions. Users default inactive. No seed or initial owner exists. Provider identity/session tables and account provisioning will be designed with the authentication decision. Normalize staff emails before persistence in that future service.

`db:check` validates migration metadata, not a live PostgreSQL execution. Live migration, rollback, connectivity and transaction tests require a configured database. Do not run production migrations concurrently or from `next build`. Use a single release step and forward-compatible migrations. Back up before destructive changes; verify the selected Neon plan's restore window and rehearse export/restore before launch. No backup capability has been tested here.

## Authentication and authorization

Auth.js is pinned to 5.0.0-beta.32 for App Router integration; reassess prerelease stability before production. `/api/auth/*` returns a safe 503/no-store response and `/admin` redirects to the staff unavailable page. No credentials are accepted. Simply setting AUTH_SECRET does not change this.

Before enabling login: select a provider/credential flow, implement secure first-owner provisioning, identity-to-local-UUID mapping, invitation/reset delivery, distributed rate limiting, session policy and login integration tests. Replace both the disabled provider list and reject-all sign-in callback deliberately. Never derive privilege from a submitted role or automatically admit an arbitrary provider account by email.

`requirePermission` resolves an active database user and current role grants for each protected operation. Session claims do not grant permission. It fails closed on missing configuration, missing identity, deactivation, no permission or provider failure. Grant `admin.access` explicitly alongside business permissions. Schema and guard exist, but staff management screens are later phases.

## Storage

Create separate R2 buckets. Enable public delivery only for product media; leave public/r2.dev/custom-domain access disabled on the proof bucket. Restrict credentials to required buckets and configure CORS to exact application origins and necessary PUT/Content-Type headers. Verify anonymous proof access is denied using real infrastructure before enabling uploads.

The adapter signs PUT/GET requests for 120 seconds, generates UUID keys and prevents proof keys from passing through public-media URL construction. GET proofs request attachment disposition and no-store. Uploads currently accept JPEG/PNG/WebP metadata up to a provisional 10 MiB ceiling; PDF is disabled. These are infrastructure bounds, not an approved final business upload policy.

There are **no public signing/upload endpoints**. Service callers must verify staff permission or order capability before invoking the adapter. Do not wire the primitive directly into a client-accessible route. Signed metadata and HEAD checks do not prove safe content: before accepting files in a later slice, compare persisted upload intent and actual size/type, inspect magic bytes, validate dimensions, sanitize/transcode images, create responsive variants and verify ownership/key binding. Quarantine unvalidated public uploads rather than exposing originals from the product bucket. Add abandonment cleanup. No proof may become a payment confirmation merely because upload succeeded.

Provider failures become generic application errors; logs omit signed URLs, object contents, credentials and raw provider exceptions. Presigner tests use isolated dummy credentials and run locally; they do not prove R2 connectivity or bucket privacy.

## Deployment and launch gates

Use separate preview/production database and buckets, configure Node 22 in Vercel and deploy through a Git-connected project. Run the README checks before releasing. Leave the prelaunch noindex/robots policy until a later SEO slice supplies actual store configuration. Domain branding in the shell is only the repository domain; no bank details, invented catalog or marketing claims were added.

Before public commerce launch, complete all later phases, configure shipping, throttling and expiry jobs, verify provider access in preview, define customer/proof retention, monitor errors and provider quotas, and rehearse backup/restore. Never claim free infrastructure is unlimited. Establish alerts for Neon storage/connections/compute, R2 storage/operations, Vercel functions/bandwidth and shipping API limits.

## Dependency maintenance

Production dependency audit and full-tooling audit are separate checks. ESLint 9 is retained because the installed Next.js React/import/accessibility plugins do not yet declare ESLint 10 support; update this toolchain together. Auth.js v5 is a pinned prerelease. The development-tool tree still reports nine advisories: four moderate through Drizzle Kit's retired esbuild loader and five high through the Next lint plugin's glob/braces chain. The registry has no patched braces release at assessment time. These counts include affected parent packages, not nine independent root vulnerabilities. No esbuild development server is exposed by this project. Do not run a forced audit downgrade to an incompatible Next/Drizzle release. Reassess before production release and when upstream tooling updates arrive.

Any remaining dev-tool advisory is a tracked maintenance issue, not a claim of a clean full audit. See the implementation plan's verification record for observed results.
