# Catalog archive E2E hotfix

## Confirmed failure

Main commit `f614e36243c889447a1215e476d09be0fc867ba5`, Actions run
`37892185809`, failed at the final search assertion in `e2e/admin.spec.ts`.
The locator `getByRole("link", { name: /TEST Browser Jacket/ })` matches both
a product card and the active search-filter removal link.

Reproduction on the unchanged production Turbopack build: wait for the
`Hasil produk` heading after the final navigation, then execute the original
assertion. It fails with expected 0 / received 1. Inspecting that one element
returns:

```text
href: /products
aria-label: Hapus filter Pencarian TEST Browser Jacket
text: Pencarian: TEST Browser Jacket ×
```

The archived product is already absent. The filter link must remain available.
Without a rendered-results assertion, the old test can also pass during the
streamed loading state, before any links exist. The pre-archive `.first()`
assertion could match the filter link without proving a product card existed.

The corrected test warms the search with a real product card, verifies the
edited price on the same search, then requires a rendered empty state, zero
results and zero links to the archived product URL. It separately verifies
that the filter-removal link remains. No timeout, retry or sleep was added.

## Cache audit

Matching any invalidated tag expires an entry; lists of tags need not be equal.
The shared `catalog` tag already connects `invalidateProduct()` to
`readCatalog()`. Adding the broad `storefront` tag would unnecessarily evict
store settings, banners and reviews.

| Mutation/read                                                      | Existing invalidation and coverage                                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product create/edit, including slug changes                        | Product POST invalidates `catalog`, `sitemap`, new product tag and previous product tag after service commit.                                                 |
| Publish, draft/unpublish, archive                                  | Status POST uses the same product invalidator after commit.                                                                                                   |
| Media completion, edit, reorder, detachment                        | Media routes invalidate product and catalog reads after metadata commits. Authorization/staging and later physical cleanup do not change public metadata.     |
| Category create/edit, rename, activation                           | Category POST expires `catalog`, `catalog-categories`, `catalog-products`, `sitemap`; this includes product detail's category fields and category visibility. |
| Search, category listings, home products, facets, related products | Cached under `catalog`, TTL 60 seconds.                                                                                                                       |
| Product detail/metadata, including cached missing products         | Scoped `product:<slug>` plus `catalog-products`, TTL 60 seconds. Both old/new slugs expire on rename.                                                         |
| Categories and category metadata                                   | `catalog-categories`, TTL 60 seconds.                                                                                                                         |
| Sitemap index and batches                                          | `sitemap`, TTL 300 seconds; existing downstream HTTP max-age remains 300 seconds.                                                                             |

Root layout, storefront pages and sitemap handlers already use
`dynamic = "force-dynamic"`. There is no Full Route Cache entry to evict for
these routes; explicit `unstable_cache` Data Cache entries still operate.
React `cache()` only deduplicates within a server render. Adding
`revalidatePath("/", "layout")` is unnecessary for this failure and would
broaden invalidation. Existing open browser tabs are not pushed live updates
by mutations in a different tab; tests request the storefront again after
committed mutations, as the original failing test does.

Inventory reservation/sale/release services separately update product stock.
Their browsing cache freshness is bounded by the existing TTL; authoritative
cart/checkout validation reads transactional database state. Promotion-only
eligibility is not projected into these cached catalog reads. Those commerce
policies are unchanged by this test hotfix.

## Regression coverage

- Browser: archive after warming search; edited price; publish after cached
  missing detail/search; slug rename; unpublish/republish; category listings;
  sitemap inclusion/removal.
- Cache contracts: actual storefront cache registrations intersect the scoped
  invalidation tags, preserve TTLs and leave unrelated cache entries intact.
- HTTP adapters: successful product/status/category/media mutations invalidate
  after the service resolves; failed mutations do not invalidate.

Run focused browser checks against `npm run build` with:

```sh
npx playwright test e2e/admin.spec.ts --project=admin --no-deps --workers=2
npx vitest run tests/catalog-cache.test.ts
```
