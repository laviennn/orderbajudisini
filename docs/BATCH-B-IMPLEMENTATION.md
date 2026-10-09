# Batch B — operational settings and content

Based on Batch A commit `a87834d8767ceff729d1d9bc2d35823065d2b474`. No checkout/payment/inventory redesign, production migration or deployment.

## Feature groups

- `/admin/seo`: `seo.read` for read, `seo.manage` for mutations. Global title/template, description, social image, homepage metadata, indexing switch and up to 500 explicit public-page overrides. Overrides support title, description, OG image, same-site canonical and noindex. Product/category editors retain their existing metadata fields. Sitemap omits noindex and alternate-canonical paths. Filtered/private pages stay noindex. Private paths cannot receive overrides. Metadata, Twitter and Open Graph use the same resolved values. Character guidance/preview is advisory. Mutations audit and invalidate storefront/sitemap caches.
- `/admin/banners`: `content.read` / `content.write`. CRUD, desktop/mobile direct R2 uploads, validated image bytes, internal name/headline/body, safe relative CTA, order, activation and optional start/end schedule. Existing homepage displays the first eligible banner by sort order then UUID; this is a single banner placement, not a carousel. Schedule times are entered in browser-local time and stored in UTC. Cache TTL bounds schedule changes to 60 seconds; edits invalidate immediately.
- `/admin/store-settings`: `settings.read` / `settings.manage`. Store name, description, public contact/address, logo, favicon, footer text, reservation duration and typed shipping origin/provider destination ID. Header/footer and root favicon consume actual configured values. Existing checkout contact/origin fields are retained. Clearing origin explicitly disables quoting; there is no default address.
- `/admin/social-media`: same settings permissions. Instagram/TikTok/Facebook HTTPS profile links restricted to their expected hosts; Indonesian WhatsApp number builds a wa.me URL. Only configured links appear in footer. Social saves update only social fields and do not overwrite store settings.

Admin JSON routes retain same-origin/body-limit checks, safe errors and server-side RBAC. UI supports disabled/read-only, uploading/saving, errors and successful save states. New panels reuse existing admin styling and storefront tokens.

## Media and technical fixes

`TEST_STORAGE_URL` is ignored when `NODE_ENV=production`. Tests intercept SDK I/O through the isolated test-server preloader, never through a production override.

Shared `validateSiteImage` checks existence, size (10 MB), MIME, byte count, actual decoder format, dimensions/pixel limit (24 million), single frame and full pixel decoding. QRIS activation calls it before mutation. Banner/logo/favicon uploads validate before acceptance and again on save. Missing/corrupt/falsely labeled images cannot activate QRIS. This validates image content, not whether the pixels encode a valid merchant QR payload.

Media remains in R2. Existing site-media signing is reused; payment proofs remain private. Detaching/deleting a banner does not delete possibly shared R2 objects. Upload cleanup/retention policy remains operational work. Site images are served directly without an image-proxy charge; upload appropriately optimized dimensions. New views do not modify stored product variants.

## Schema and rollout

- `0012_batch_b_seo.sql`: `seo_settings.indexing_enabled`, typed JSON `pages`.
- `0013_batch_b_store.sql`: store description, logo/favicon keys, footer text, typed social links JSON.

Existing rows are preserved; indexing defaults to enabled, page overrides default empty and store additions nullable. Apply through `npm run db:migrate` in a separately authorized release. This task uses only disposable databases; production is untouched. Configure real content through the new admin panels. No fake production content is inserted.

## Validation and inherited fixes

Production route checking exposed an inherited synchronous `searchParams` declaration in the payment queue; it now awaits Next's promise. Browser validation exposed the dashboard querying order status `submitted`; it now uses the existing `payment_submitted` enum value. These small fixes preserve the intended workflows. `ws` is externalized alongside Neon so webpack does not bundle its optional native dependencies incorrectly.

The original payment-proof browser fixture depended on the removed production storage override. It now explicitly intercepts only TEST R2 upload URLs and forwards bytes to isolated loopback storage, as the catalog test already does. QRIS test doubles now supply real image bytes. A separate formatting-only commit normalizes inherited formatting to satisfy the repository-wide gate.

Final results are recorded in IMPLEMENTATION-PLAN.md. Coverage includes RBAC/audits, settings persistence, metadata/canonical/indexing and sitemap inclusion, banner schedules/deletion, actual media decoding/QRIS rejection, production storage isolation, plus one end-to-end owner workflow through all four panels with mobile overflow and accessibility checks.
