# Product Catalog, Media & Reviews

## Product Requirements

Secondhand products need richer factual fields than generic fashion: -
SKU - name - category - brand optional - price - size label - actual
measurements - condition grade - condition notes - defects - images
including defect images - availability/status - description - SEO
metadata

## Images

Recommended upload policy: - validate MIME and actual file signature -
enforce max dimensions/bytes - strip unsafe metadata where appropriate -
generate normalized web variants during upload pipeline if feasible -
use deterministic/UUID object keys - preserve sort order - alt text
editable - product images public; proofs private

Do not upload originals at 5--15MB and serve them directly.

## Product Status UX

-   draft: admin only
-   active: purchasable
-   reserved: visible but unavailable or clearly reserved, depending
    policy
-   sold: visible with SOLD state and related products
-   archived: removed from normal listing; SEO behavior handled
    deliberately

## Search/Filtering

MVP can use PostgreSQL text matching and indexed filters. Do not add
Algolia/Elastic unless scale proves need.

## Reviews on Product Detail

Public section: - average rating if at least one approved review -
review count - individual approved reviews - empty state that does not
pretend social proof exists

Review card: - display name - rating - body - date - verified purchase
indicator only if actually linked to eligible order

## Review Integrity

-   never seed fake customer reviews in production
-   never mark a review "verified" without order evidence
-   moderation status required
-   sanitize rendered user content
-   rate-limit public submission if enabled

## Related Products

Use deterministic rules such as category + availability + recency. Do
not require AI recommendations.
