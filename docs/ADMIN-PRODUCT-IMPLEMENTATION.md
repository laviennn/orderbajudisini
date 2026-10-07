# Phase 3.5 — Admin product operations

Phase 3 inspection found that the expected Phase 2 admin catalog and image ingestion workflow did not exist. This recovery adds that workflow to the existing Auth.js, permissions, Drizzle, catalog, promotion and R2 infrastructure. It does not implement checkout, payment UI, shipping integration or a second pricing engine.

## Routes and operator workflow

| Route                          | Purpose                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `/admin/login`                 | Existing staff credentials login                                                        |
| `/admin`                       | Actual product counts and recently updated products                                     |
| `/admin/products`              | Server-paginated product table, search by name/SKU, status/category/eligibility filters |
| `/admin/products/new`          | Create a draft                                                                          |
| `/admin/products/[id]/edit`    | Edit saved product, measurements, media, eligibility and SEO; publish/archive           |
| `/admin/products/[id]/preview` | Authenticated, noindex preview of saved information and images                          |
| `/admin/categories`            | Create/edit categories, ordering, active status, description and SEO                    |

Login → create draft → save product information → select/drop photos → upload/inspect/reorder → preview saved data → publish. Photos save independently; uploading does not reset unsaved product fields. Status actions use the saved revision and warn if the form is dirty. Failed saves retain entered values. Save product edits before publishing them.

The public shell was moved into an App Router route group without changing public URLs. Admin has its own compact navigation and logout. Future modules are omitted rather than represented by fake links or metrics. Tables scroll inside a labelled region on small screens; editors collapse to one column.

Product lists fetch 24 rows plus one pagination sentinel, at most page 1000. Category choices/management are bounded to 500 rows, appropriate to the current catalog; a catalog exceeding that needs category search/pagination before expansion. No browser-side full product database is loaded.

## Mutations and data integrity

`src/server/services/admin-products.ts` owns transactional create/edit/status/category rules. Zod schemas in `src/features/admin/validation.ts` validate all authoritative input. Money remains integer IDR; measurements retain flexible keys, labels, decimal values and units. The operator enters only label/value/unit; new measurement keys are generated internally and existing keys remain stable. Native form controls and shared server Zod validation reuse the repository’s form pattern without adding a form-state dependency. SKU and slug uniqueness are checked for useful errors and enforced by PostgreSQL. Create always produces a draft. Unknown input fields are rejected.

Edits lock the product, compare its `updatedAt` revision, update its fields and replace its submitted measurements in one transaction. Stale edits return `CONFLICT` instead of overwriting another operator. Separate image and promotion-target relationships survive ordinary information edits. The pricing advisory lock is acquired before product locks, preserving the existing checkout/cart ordering and consistent price/eligibility changes.

Reserved and sold products, including active products with outstanding reservations for part of their stock, cannot be changed through these catalog mutations. Commerce services retain control of sale/reservation states. Published products require positive stock, an active category, description/condition notes and at least one non-defect image. The final non-defect image cannot be removed or marked as a defect while active. There is no unrestricted status dropdown or hard product deletion. Products may be returned to draft, published or archived through explicit permission-checked actions.

Category deactivation hides its products from public queries without deleting or orphaning them. Category editing has optimistic revision checks. There is no destructive category delete. Changing a previously published product slug or an existing category slug needs explicit confirmation; redirects are not implemented, and the interface warns that the old URL stops working.

## Authorization and HTTP boundaries

Existing `withStaff` transactions resolve active users and current database permissions; hiding UI controls is supplementary. Existing session revocation/identity locking remain intact.

| Operation                        | Required permissions                                      |
| -------------------------------- | --------------------------------------------------------- |
| Admin shell                      | `admin.access`                                            |
| List/detail/preview              | `products.read`                                           |
| Create / edit information        | `products.create` / `products.update`                     |
| Publish / return to draft        | `products.publish`                                        |
| Archive                          | `products.archive`                                        |
| Category choices/list / mutation | `categories.read` / `categories.write`                    |
| Authorize/complete/change media  | `media.write` and `products.update`                       |
| Retry queued media cleanup       | `media.write`                                             |
| Change bundle eligibility        | Product create/update permission plus `promotions.manage` |

Owner has all existing grants. Catalog Operator can manage catalog/media but cannot change eligibility without an explicitly granted `promotions.manage`; the disabled control preserves its existing value. Order Operator cannot publish or mutate catalog. Product/category SEO is part of their respective edit permissions; existing `seo.manage` continues to protect global SEO configuration.

`/api/admin/products`, `/api/admin/categories` and nested product status/media handlers call these services. Mutation requests require same-origin JSON and a bounded 128 KiB body. Responses are no-store, return controlled application errors and never expose password hashes or permanent storage credentials. Services remain reusable without HTTP dependencies. Any future service caller that changes public data must also invalidate the appropriate cache after commit.

## Promotion and SEO

The editor changes the existing `products.promotionEligible` field only. Existing campaign rules, product/category targets, grouping strategies and pricing policy are preserved. The checkbox alone does not create/activate a campaign. Three eligible items total Rp100,000 only when an existing active, matching campaign has those configured values. No production campaign/default allocation policy is invented, and no promotional badge is added to public listings. Integration tests configure an isolated campaign and verify totals change 135000 → 100000 → 135000 as eligibility changes through this editor service.

Existing `seoTitle` and `seoDescription` fields feed the Phase 3 Metadata API. Guidance is advisory; it does not promise a search-engine rendering. Authenticated browser tests edit SEO and verify the rendered public title/description, together with price and media order.

## Audit and cache

Transactional audit events cover creation/edits, publication/unpublication/archive, eligibility, SEO, category and media changes. Metadata contains bounded changed-field names or states, not full descriptions, image bodies or secrets.

HTTP adapters invalidate only after a service commits:

- Product changes: catalog lists/facets/home/related queries, sitemap, and the current product detail tag; slug changes also invalidate the former slug.
- Category changes: catalog, category queries, product-detail category dependencies and sitemap.
- Media changes: the same product/catalog tags; immutable new random object keys avoid stale overwritten assets.

Global settings/banner/review caches are not purged for every product edit. Existing 60-second fallback revalidation remains. Cart pricing reads authoritative database state, not catalog cache.

## Setup and validation

Apply source-controlled migration `0003_product_media_pipeline.sql` with `npm run db:migrate` to the intended database before deploying this code. Follow [ADMIN-BOOTSTRAP.md](ADMIN-BOOTSTRAP.md), enable `AUTH_ENABLED=true`, and configure the existing Auth secret/Neon connection. See [MEDIA-PIPELINE.md](MEDIA-PIPELINE.md) for bucket policy/CORS and deployment checks. No production migration, bootstrap, media write or deployment is performed by this task.

Unit tests cover actual Sharp optimization and input rejection; real isolated PostgreSQL tests cover catalog/media/RBAC/promotion state and failure recovery. Browser tests use real Auth.js, application handlers, PostgreSQL and Sharp with only provider object I/O redirected to a local test store. Phase 3 public browser tests remain part of the suite. Exact final results are recorded in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md).
