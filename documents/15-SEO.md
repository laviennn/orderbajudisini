# SEO Specification

## Admin-Editable Basic SEO

Owner/operator with `seo.manage` can edit: - site title - title
template - default meta description - default OG/social image - homepage
SEO title/description - category SEO title/description - product SEO
title/description

## Metadata Fallback

Example precedence:

``` txt
product.seo_title
→ `${product.name} | ${store.name}`

product.seo_description
→ safe generated summary from factual product fields
→ site default only as final fallback
```

Generated fallback must not invent claims.

## Technical SEO

-   Next.js Metadata API
-   canonical URLs
-   `sitemap.xml`
-   `robots.txt`
-   Open Graph
-   Twitter/X metadata if useful
-   breadcrumb structured data
-   Product structured data when data qualifies
-   Organization/WebSite schema where appropriate
-   semantic headings
-   crawlable links
-   optimized media
-   stable slugs

## Product Structured Data

Only expose truthful values: - name - image - description - SKU - brand
if known - offer price/currency - availability - aggregateRating only if
real approved review data satisfies requirements Never output fake
rating/review schema.

## Sold Products

Do not instantly 404 a sold product. Default: - keep page accessible -
mark sold/unavailable - show related available products Later
archive/redirect policy may be configured based on SEO value.

## Filter Pages

Avoid index explosion. Canonicalize or noindex low-value faceted
combinations where appropriate.

## Admin Safety

Meta title/description fields show recommended character guidance but do
not hard-fail solely on character count. Preview is advisory, not a
guarantee of Google SERP rendering.
