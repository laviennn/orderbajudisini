# Information Architecture

## Public Routes

``` txt
/
├─ /products
│  └─ /products/[slug]
├─ /category/[slug]
├─ /track-order
├─ /order/[publicToken]          # optional secure order status/payment page
├─ /checkout
├─ /checkout/success
├─ /about
├─ /how-to-order
├─ /shipping
├─ /payment
├─ /faq
├─ /privacy
└─ /terms
```

## Admin Routes

``` txt
/admin
├─ /login
├─ /dashboard
├─ /products
│  ├─ /new
│  └─ /[id]/edit
├─ /categories
├─ /orders
│  └─ /[id]
├─ /payments
├─ /reviews
├─ /media
├─ /content
│  ├─ /homepage
│  └─ /banners
├─ /seo
├─ /operators
├─ /settings
│  ├─ /store
│  ├─ /payment
│  ├─ /shipping
│  └─ /contact
└─ /audit-log
```

## Navigation Rules

Public primary navigation should remain compact: Home, Shop,
categories/collections if needed, Track Order. Do not fill navigation
with low-value pages.

Mobile uses a deliberate drawer/sheet, not a desktop menu squeezed
smaller.

Admin navigation groups: - Overview - Catalog - Commerce - Content -
Administration

## URL Rules

-   lowercase
-   hyphenated slugs
-   stable product URLs
-   no database IDs in customer-facing product URLs unless required for
    collision handling
-   canonical URLs generated consistently
-   filters use query params
-   prevent indexation of low-value filter combinations
