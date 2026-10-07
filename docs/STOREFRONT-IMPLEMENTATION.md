# Phase 3 — Storefront implementation

> Phase 3.5 update: the missing admin/media prerequisite identified in this Phase 3 record is now implemented. See [ADMIN-PRODUCT-IMPLEMENTATION.md](ADMIN-PRODUCT-IMPLEMENTATION.md) and [MEDIA-PIPELINE.md](MEDIA-PIPELINE.md). Live production verification is still required. The historical Phase 3 findings below remain for context.

## Repository assessment and scope

The repository contained Phase 0 and Phase 1A, with no commits yet. Contrary to the task's starting assumption, there was no Admin Product Management UI, product/category repository, verified media upload pipeline or image-family variant linkage. The existing schema, Auth.js/RBAC, R2 adapter, approved-review repository, promotion eligibility and centralized pricing engine were preserved. New public repositories/services fill the missing browsing boundary; no duplicate tables, promotion fields or pricing algorithms were introduced.

This phase implements browsing through cart. It does not create orders, reserve inventory, collect addresses, calculate shipping, upload payment proofs, confirm through WhatsApp or implement tracking. Phase 1A's internal transactional services remain intact and are not exposed by new customer endpoints. Admin Product Management and the R2 media pipeline remain a separate prerequisite for operators to populate and maintain the live catalog.

## Routes

| Route                              | Behavior                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/`                                | Configured active banner or factual text fallback; recent active products; active category links        |
| `/products`                        | Paginated public catalog with shareable search/filter/sort URLs                                         |
| `/category/[slug]`                 | Active category with scoped catalog, description and metadata                                           |
| `/products/[slug]`                 | Public product details, gallery, measurements, condition/defects, approved reviews and related products |
| `/cart`                            | Persistent guest cart with current server pricing and unavailable entries                               |
| `/track-order`                     | Honest unavailable placeholder; no tracking lookup                                                      |
| `POST /api/cart/price`             | Validates up to 100 unique IDs and returns current safe product/pricing projections, no-store           |
| `/sitemap.xml`, `/sitemaps/[page]` | Sitemap index and bounded active-product/category batches                                               |
| `/robots.txt`                      | Public browsing allowed; admin/API/cart/order/checkout/tracking excluded                                |

Staff authentication and existing admin entry are preserved and noindex. No customer accounts are introduced.

## Architecture and catalog queries

Server Components call `src/server/services/storefront.ts`, which caches public repository reads. `src/server/repositories/catalog.ts` selects explicit public fields and parameterizes PostgreSQL filters. Drafts and archived products never appear in public lists/details/cart projections; inactive categories hide their products. Default catalog results are active only. Explicit availability filters can show reserved/sold items, which remain unavailable to cart pricing.

Catalog pages request 25 rows to display 24 and detect the next page. Page numbers are capped at 1000. Related items are at most four active products from the same category, excluding the current product, ordered deterministically by publication/id. Categories are capped at 100 for navigation. Facets have bounded distinct values. Product-card links disable automatic route prefetch so merely viewing a page does not fetch dozens of product details. There is no entire-catalog browser payload and no per-product image/review round-trip: the listing query chooses one image using an indexed correlated SQL subquery. Detail reads bound gallery to 40 image rows and measurements to 30 rows. Reviews paginate 20 at a time with a separate approved-only aggregate.

Search is submitted explicitly, not requested on every keystroke. PostgreSQL ILIKE covers name, SKU, brand and category; `%`, `_` and backslash in user input are escaped as literals. Filters support category, size, condition, price bounds and availability. Sort supports newest, price ascending and descending with stable ID tie-breaking. Invalid values normalize safely; unknown extra parameters are ignored. Only useful size/condition/price controls are rendered. Mobile uses a modal filter sheet; desktop uses a restrained sidebar. Filter links remove individual criteria or reset all, preserving meaningful URL state.

The existing status/publication and category/status indexes support browsing. Arbitrary substring search and distinct facets still need workload measurement for very large catalogs; PostgreSQL trigram/full-text tuning can be added when measurements justify it. No external search service is introduced.

## Product detail and reviews

Product information uses plain React text rendering, never arbitrary HTML. Condition notes, actual measurement labels/units and disclosed defects remain factual and visible. Sold/reserved pages retain their URLs and disable adding to cart. Invalid/non-public product or category slugs invoke Next notFound; provider/database failures remain errors, not false 404s or empty successful datasets.

The gallery uses native keyboard-operable thumbnail buttons, an announced selected image, reserved aspect ratios and eager priority for the main image. Defect images also appear in a visible condition section. Related products are deterministic and active only.

Existing review repository methods exclude pending/rejected records, return a narrow projection and derive verified purchase from a matching completed order. Empty reviews show no artificial stars/rating. No public review submission endpoint is created because eligibility, intake and duplicate policy remain unresolved.

## R2 media and missing Phase 2 prerequisite

Images use the existing `getStorage().publicMediaUrl` validator and real persisted keys; no guessed variant paths or fake production URLs are generated. Browser delivery is directly from the configured public R2 domain, without a Next image transformation proxy. Payment-proof keys cannot pass the public media helper. Internal object keys and eligibility fields are not separate public DTO properties; the public delivery URL necessarily contains its public object's path.

Cards prefer a recorded card variant, then detail, then other recorded media at the same image sort position. Because the current schema has no image-family relationship, the storefront does not invent srcset families by assuming arbitrary rows are the same photograph. It supplies the actual asset width/sizes, uses object-contain to preserve clothing detail, and lazy-loads noncritical images. Large product sources over 1.5 MB, 2000px width or 2400px height are not served; missing/rejected/broken images display a factual unavailable state. These are storefront delivery bounds, not a completed upload optimization pipeline. Banner rows support configured desktop/mobile keys, but their upload validation/optimization still depends on the absent Phase 2 pipeline.

Production must supply genuine, optimized image records through the missing admin/media slice. Browser QA uses clearly marked test fixtures and locally intercepted test images; it does not verify live R2 object delivery, upload acceptance or real photography quality.

## Cart and centralized pricing

`src/features/cart/store.ts` uses useSyncExternalStore around localStorage, storing only unique product UUIDs in insertion order (maximum 100). Hydration starts with an empty server snapshot; storage is read on subscription. Add is idempotent; remove/clear and cross-tab changes are supported. Unavailable storage retains in-memory state with an explicit message. No persisted client price, discount, total or stock claim is trusted.

Opening/changing the cart or returning to its browser tab triggers a no-store server validation. Stale responses are ignored, and errors remove the old total until a successful retry. The API reloads product/category visibility and availability, holds shared pricing/product locks for a consistent calculation, and calls the existing `priceLockedProducts` service. This is a price preview, never a reservation. Phase 4 must revalidate again during transactional order creation.

Unavailable cart lines remain visible, can be removed and do not contribute to totals. Draft/archived/deleted entries are shown generically without leaking their name/price. One product represents one unit; no meaningless quantity stepper is rendered. Header count reflects cart lines. The cart explains original subtotal, applied bundles, discounts or fixed-bundle surcharges and merchandise total. Shipping is explicitly excluded and checkout is disabled with a factual message.

Product cards and product information do not receive or advertise promotion eligibility. Only cart pricing explains applied adjustments. The pricing engine is unchanged: eligibility is explicit, campaigns must be active/configured, and groups use the existing documented highest/lowest-price strategy with deterministic ID tie-breaking. Visual cart insertion order does not silently replace that strategy. Remaining eligible units retain normal prices; interleaved noneligible products do not break bundles. Both configured discount-only and fixed-bundle policies are preserved. No global three-item promotion is invented or enabled.

## SEO and analytics

Metadata uses configured homepage/site defaults and product/category overrides with factual fallbacks. Stable canonicals omit filter parameters; filtered catalog/category pages are noindex,follow. Product structured data includes actual name, SKU, description, optional brand, images, IDR price and availability; aggregateRating only appears when approved reviews exist. Breadcrumb links and structured data are included. JSON-LD escapes `<` to prevent script injection. Sold product URLs remain accessible. Cart/admin/private routes are not indexable.

The root no longer blanket-noindexes the whole site. Deployment readiness must be reviewed before releasing the storefront; this task did not deploy or change live indexing. Sitemaps include public active products only, plus active categories; they omit private routes and drafts. Sitemap responses fail with 503/no-store on database failure instead of publishing a misleading empty success.

`src/lib/analytics.ts` centralizes typed view_item_list, select_item, view_item, add_to_cart, remove_from_cart and view_cart events. Payloads contain only fixed event names, IDR currency and product IDs; no free-text search, PII, capability token or proof URL. The adapter queues dataLayer events only when NEXT_PUBLIC_GTM_ID is configured. It does not inject a vendor loader or claim events have reached GA/GTM; vendor activation/consent configuration and purchase tracking remain later work.

## Caching and failures

Public reads cache for 60 seconds with the shared `storefront` tag; detail metadata/rendering also use request deduplication. Future product/category/media/review/SEO/content mutations must invalidate that tag after committing. Pricing is never cached. Sitemap data caches for 300 seconds. Dynamic route rendering avoids database calls during builds while retaining the explicit data cache. Cached storefront stock is advisory; cart and eventual checkout revalidate it.

Root branding can fall back to the previously owner-supplied store name when configuration is unavailable, logging only a fixed event. Actual catalog/product query errors surface through the error boundary with a retry action. Empty, no-results, missing-media and true not-found states are separate. Catalog/category route loading skeletons match the grid; home streams its data section and cart announces asynchronous validation.

## UI/UX and QA

Existing neutral semantic tokens are preserved. The design uses a compact typographic header, product photography, restrained separators, consistent image ratios, factual copy and minimal rounding. Two-column mobile grids expand deliberately; detail moves from gallery/info columns to a stacked mobile flow. Native modal dialogs provide focus containment, Escape dismissal and focus return. Controls have labels, visible focus, accessible names and reduced-motion support. No fabricated products, testimonials, reviews, discounts or scarcity were added to production.

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration`, `npm run db:check`, `npm run build`, and `npm run test:e2e`. The E2E harness starts disposable PostgreSQL with test-only records, bridges the existing Neon WebSocket driver through a loopback proxy and launches the production build. Its preloader modifies only the test server process, never production runtime configuration. The Neon package is an external server dependency so the Node runtime and test preloader share the same driver configuration instead of a separately bundled copy. Real production secrets and databases are not used by that harness.

QA covers 360×800, 390×844, 768×1024, 1366×768 and 1440×900, overflow and axe checks; browsing, category/search/filter/sort/pagination; public/sold/draft detail; approved-only reviews; cart add/remove/reload, mixed eligibility, three/six-item bundles, unavailable lines, failure retry, mobile dialogs, SEO and sitemap privacy. Final result: 40 unit tests, 26 PostgreSQL integration tests and 16 browser tests passed, together with typecheck, zero-warning lint, schema check and production build. Exact verification boundaries are recorded in IMPLEMENTATION-PLAN.md.

## Open decisions and external configuration

- Production promotion grouping and price policy still require explicit configuration; see PROMOTIONAL-PRICING.md. No production default is chosen.
- Phase 2 admin/product/media implementation remains missing in this repository, despite the task's assumption. Complete it before operator-managed catalog launch.
- Apply existing migrations to the intended Neon environment, bootstrap a real Owner and activate staff login using the existing runbook before operational use. This phase performed none of those production mutations.
- Supply legitimate products, categories, images, banners and SEO content; verify R2 custom-domain access and private proof settings independently.
- Password recovery, review intake, shipping policies/credentials, retention, and analytics consent/vendor loading remain out of scope.

Recommended next requested phase: **Phase 4 — Checkout + Shipping Rates + Transactional Order Creation + Inventory Reservation + Final Server-Side Pricing**. Do not begin it automatically, and resolve the missing admin/media prerequisite before claiming an operational end-to-end shop.
