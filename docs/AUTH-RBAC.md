# Authentication and authorization

Authentication is staff-only: Owner and operators. Customers do not need accounts. Auth.js uses Credentials authentication with a local user UUID and encrypted JWT session cookies lasting at most eight hours. HTTPS cookies are Secure, HttpOnly and SameSite=Lax. Auth.js CSRF handling protects its sign-in flow; the application login action returns a generic failure.

Passwords are salted scrypt hashes (N=32768, r=8, p=3; 64-byte output, random 16-byte salt), checked with timing-safe comparison. New passwords require 15–128 characters. Missing users still perform the password derivation. Neither hashes nor passwords are returned by session/operator APIs or written to audit metadata.

Login uses atomic PostgreSQL rate limits: five attempts per normalized email and thirty per network bucket in fifteen minutes. Identifiers are HMAC hashes. On Vercel only its trusted forwarded header is used; other deployments conservatively share a local network bucket until a trusted proxy policy is implemented. Database failure fails closed. Expired limiter rows can be pruned operationally; no in-memory multi-instance security dependency exists.

## Activation and sessions

Login remains disabled unless AUTH_ENABLED=true and DATABASE_URL/AUTH_SECRET are configured. Migrate and bootstrap first. Disabled routes return 503/no-store. `/admin/login` is the minimal working credentials screen; `/admin` requires admin.access and provides logout. `/api/admin/session` returns a minimal authorized identity/permissions response with no-store.

JWT claims contain identity and session version, not authoritative permissions. Every protected operation reloads the active user, matching session version and current database grants. Deactivation or role changes increment sessionVersion and invalidate existing authorization immediately. The Auth.js session endpoint may still describe an old identity until cookie expiry; that cookie cannot pass application authorization. No public signup, password reset transport or invitation email is implemented.

## Permissions and defaults

The typed source of truth is `src/server/auth/policy.ts` (29 permission keys).

| Area             | Keys                                                                                |
| ---------------- | ----------------------------------------------------------------------------------- |
| Entry            | admin.access                                                                        |
| Products         | products.read, products.create, products.update, products.publish, products.archive |
| Categories/media | categories.read, categories.write, media.read, media.write                          |
| Orders/payments  | orders.read, orders.update, payments.read, payments.verify                          |
| Reviews/shipping | reviews.read, reviews.moderate, shipments.read, shipments.update                    |
| Content/SEO      | content.read, content.write, seo.read, seo.manage                                   |
| Operations       | operators.read, operators.manage, settings.read, settings.manage, audit.read        |
| Promotions       | promotions.read, promotions.manage                                                  |

Owner receives all permissions. Catalog Operator receives admin entry, all product/category/media permissions, review read/moderation and promotion read. It cannot manage operators/settings or verify payments. Order Operator receives admin entry, order read/update, payment read/verify and shipment read/update; it cannot publish products or manage operators/settings. Additional roles and grants are database-backed and extensible; no client-supplied role controls authorization.

## Server primitives and operator rules

`requireAuthenticatedUser()` and `requirePermission(permission)` protect Server Components, Actions and Route Handlers. `hasPermission` is a pure convenience predicate. Mutating services use `withStaff(permission, callback)`: it authenticates, starts a transaction, takes the identity lock and rechecks live grants within that transaction. Call these services from future Actions/Handlers instead of trusting UI state or accepting actor/permission claims from request payloads.

Operator services list/get/create and change role/activation. They require operators.read/manage respectively, never expose password hashes, and audit changes atomically. Operator creation is the credentials foundation for the later management UI, not an email invitation workflow. Exclusive identity locking serializes concurrent role/deactivation changes and prevents removal of the last active Owner. Owner status is a protected database role property, not a role-name comparison scattered through features.

Audit events cover bootstrap/operators, product publication/archive event types, payments, order status, tracking, SEO/store/bank settings, promotions and moderation. Event metadata is validated through a strict allowlist. Product editing/publication services and their UI arrive in the next phase; they must use the existing audit primitive.

Consistent AppError codes include UNAUTHENTICATED (the existing project's equivalent of UNAUTHORIZED), FORBIDDEN, VALIDATION_ERROR, PRODUCT_UNAVAILABLE, INVALID_ORDER_TRANSITION, PAYMENT_ALREADY_VERIFIED, RESERVATION_EXPIRED and LAST_OWNER. Unknown SQL/provider failures become generic errors; raw exceptions are not sent to clients.

## Tests and limitations

Unit tests assert role permissions and password behavior. Real PostgreSQL tests invoke protected services with authenticated identity fixtures while retaining actual permission checks, then exercise role revocation and competing last-owner changes. Separate tests invoke the real Auth.js core with CSRF/cookies, reject bad passwords, inspect secure session cookies and check revoked sessions against the database.

Auth.js remains the pinned Phase 0 prerelease. Full operator UI, password recovery, session administration and email transport are future work; do not claim they exist. A lost last-owner password currently requires an audited, controlled database/operator recovery procedure, not rerunning bootstrap or enabling a default account.
