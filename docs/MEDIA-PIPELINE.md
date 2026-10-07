# Product media pipeline — Phase 3.5

## Direct upload and ingestion

The existing R2 adapter is extended, not replaced. The browser sends only metadata to an authenticated authorization route. The server checks `media.write` + `products.update`, locks the editable product, validates metadata and commits a durable upload plan. It returns a two-minute signed PUT URL for a random `product-source/<uuid>.<jpg|png|webp>` key in the **private bucket**. Permanent credentials never reach the client.

The browser sends source bytes directly to R2. XHR reports actual transfer progress, followed by a separate processing state. Completion sends only the upload ID. The server checks actor/product ownership and expiry, HEAD-checks exact declared size/MIME, downloads at most 10 MiB, and uses Sharp to decode the actual file. JPEG, PNG and static WebP are accepted; content must match the declared MIME. Minimum source dimensions are 100×100; maximum decoded area is 24 megapixels. Invalid/truncated, animated, SVG and unsupported inputs are rejected. Extension alone is never acceptance evidence.

Sharp auto-orients and strips EXIF/GPS metadata, encoding WebP at quality 85 once during ingestion. There are three aspect-preserving, non-upscaled variants:

| Variant   | Maximum width × height | Use               |
| --------- | ---------------------- | ----------------- |
| thumbnail | 320 × 427              | Admin/small image |
| card      | 720 × 960              | Catalog cards     |
| detail    | 1440 × 1920            | Detail/inspection |

Each output must fit the existing 1.5 MB delivery bound. Rejected outputs are not attached. There is no paid image service, runtime customer-request transformation or public original image delivery. Ingestion uses the Node runtime and the completion handler declares a 60-second maximum duration. Actual hosting limits still apply; process files one at a time and retry transient failures. No service claims unlimited free processing.

The server writes three `product/<random-uuid>.webp` objects to the public bucket, then atomically attaches three metadata rows, marks the plan ready and audits the operation. Repeating completion is idempotent. A product lock serializes completion/reordering/removal; the client does not need to refresh the page. Up to 10 files are queued with **one upload/processing operation at a time**. Up to 40 image families per product and 10 unfinished plans are accepted.

## Database representation and URL resolution

Migration `0003_product_media_pipeline.sql` adds nullable `product_images.group_id`, a unique group/variant index and grouped-variant check, plus `media_uploads` and `media_deletions` with indexed product/expiry ownership, strict foreign keys and unique object keys. Total application tables become 31. Existing legacy image rows keep a null group and remain readable; no original catalog tables are recreated.

An image family uses the upload UUID as `group_id`. Each variant retains its actual dimensions, MIME, bytes, object key, alt text, defect flag and shared sort order. The private source/ready state and predetermined output keys live in the upload plan. PostgreSQL stores no binary image data.

The catalog repository resolves real stored variant rows into a public image DTO with width candidates. Components render this `srcset`; they never guess filenames. Gallery queries select one detail row per family rather than displaying all three variants as separate photos. Legacy rows retain their single known URL. Public URLs are produced exclusively through the existing public bucket base URL. Private keys cannot be converted into a public URL.

Primary imagery is the first non-defect family ordered by persisted `sort_order` and deterministic ID tie-breaks. Reordering requires exactly the current set of representative IDs; all family rows move together. Alt text and defect edits also apply to the entire family. Product-name/position fallback is editable and does not invent visual attributes.

## Removal and failure recovery

Database and R2 cannot share a transaction. The implementation keeps durable work records instead of pretending they do:

1. Upload plans, source keys and all output keys commit **before** any variant write. A failed/crashed processing attempt cannot lose the list of partial objects. Retrying completion rewrites the same keys and attaches one family.
2. Removal verifies permission/relationship and atomically detaches the whole family while enqueuing every output key in `media_deletions`. The HTTP route attempts cleanup after commit. Failure is reported as pending cleanup, not a restored attachment or silent success.
3. “Bersihkan unggahan tertunda” retries queued deletes and expired plans. Each batch handles at most 120 deletion jobs and 10 expired plans using `FOR UPDATE SKIP LOCKED`. Failed deletes remain queued with attempt counts; deletion is idempotent.
4. Plans expire after 30 minutes. For failed/abandoned plans cleanup deletes the private source and all planned outputs. For ready plans it deletes the source and plan only, preserving attached variants. This is longer than the signed PUT lifetime, avoiding deletion followed by replay of a still-valid upload URL.

Cleanup is operator-triggered in this phase; there is no deployed cron. A product need not be editable/sale-active to clean detached objects. Operators can retry cleanup from its editor. A private R2 lifecycle rule scoped **only to `product-source/`**, expiring sources after one day, is recommended as a storage backstop. It does not replace database/output cleanup. Never apply that rule to `payment-proof/`. Private proof storage/access semantics are unchanged.

Browser retry can repeat processing for successfully transferred files. If authorization has expired or the source itself is invalid, remove the queued file and select it again. Abandoned plans remain discoverable for cleanup. Immutable public URLs can remain in a CDN cache until its TTL after origin deletion; removal detaches them from all current application queries. Product media is not a private-data erasure mechanism.

## Real R2 configuration

Existing environment variables remain: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BASE_URL`. Both buckets require server-side object read/write/delete permission. Use `assets.orderbajudisini.com` only on the public asset bucket. Keep the private bucket without custom domain/public development URL; its configured name must exactly match the actual bucket, including singular/plural spelling. Payment proofs remain private.

The **private** bucket needs CORS for direct browser PUT from the exact deployed admin origin. Example configuration for production (add a specific localhost/preview origin only when needed):

```json
[
  {
    "AllowedOrigins": ["https://orderbajudisini.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

See the official [Cloudflare R2 CORS guide](https://developers.cloudflare.com/r2/buckets/cors/) for dashboard configuration. CORS permits the browser request; it does not make objects public and does not replace signature authorization. The signed URL binds the random key, content type and length. Bucket credentials/custom domain/CORS are not exercised by local provider-boundary tests. Before production acceptance, use a real authorized staff account in the deployed app to upload a genuine product photo, confirm all variants load from the public domain, reorder/delete and retry cleanup, and confirm the source/proof prefixes cannot be fetched publicly. Do not use production-looking fixtures.

AWS SDK packages are explicitly externalized in Next's server bundle, alongside the existing Neon package. This keeps a single Node SDK instance and lets the isolated browser harness replace only provider I/O. Test redirection lives entirely under `tests/e2e`, validates loopback destinations and is never loaded by the application deployment. Sharp is an explicit production dependency.

## Cost and operating limits

Bytes move browser→R2 for source upload; the function downloads and transforms once, then writes three variants. This consumes R2 operations, temporary source storage and Vercel CPU/memory. Customer delivery uses immutable R2/CDN URLs and responsive stored variants. Bounded source bytes/pixels, sequential transforms and bounded browser queue control per-operation work. Monitor actual account quotas and clean expired plans; no paid service or subscription was introduced.
