# Performance & Media Strategy

## Main Risk

Catalog image traffic can dwarf database traffic. Therefore media
storage/delivery is separated from Neon.

## R2 Strategy

-   public product media served directly through media domain/CDN
-   private payment proof objects
-   DB stores object keys + metadata
-   browser should not fetch every image through Next.js proxy

## Upload Optimization

Target practical variants such as: - thumbnail \~320--400 px - card
\~640--800 px - detail \~1200--1600 px Exact values should follow
design/device testing.

Prefer WebP/AVIF where pipeline/browser strategy supports it. Keep
quality visually acceptable for clothing texture/defects.

## Next.js Image

Use intentionally. Do not assume unlimited Vercel image transformation.
If R2 stores pre-sized variants, use responsive `srcset/sizes` strategy
compatible with deployment quotas.

## Database Performance

-   select only required fields
-   paginate
-   indexes from schema doc
-   avoid N+1
-   aggregate reviews efficiently
-   cache public reads where correctness allows

## Web Vitals

Targets: - LCP image prioritized only when truly above fold - reserve
image aspect ratio to prevent CLS - minimize client JS - Server
Components default - lazy-load below-fold images - fonts optimized and
limited

## Ads Spike Readiness

A traffic spike should primarily hit cached app output + CDN media, not
perform expensive database/media transformations for every request.
