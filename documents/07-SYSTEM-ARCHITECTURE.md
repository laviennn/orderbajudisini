# System Architecture

## High-Level

``` txt
Browser
  ├─ HTML/RSC/API → Vercel / Next.js
  │                    ├─ Neon PostgreSQL
  │                    ├─ R2 signed upload/access operations
  │                    └─ Shipping Provider API
  └─ Product media → R2 custom/public media domain
```

## Domain Modules

``` txt
src/
├─ app/
├─ components/
├─ features/
│  ├─ catalog/
│  ├─ checkout/
│  ├─ orders/
│  ├─ payments/
│  ├─ shipping/
│  ├─ reviews/
│  ├─ seo/
│  └─ admin/
├─ server/
│  ├─ db/
│  ├─ auth/
│  ├─ storage/
│  ├─ services/
│  └─ repositories/
├─ lib/
└─ styles/
```

## Layer Rules

UI → application/service → repository/provider. Do not query Drizzle
directly from arbitrary presentation components. Do not call R2/shipping
APIs directly from client components.

## Caching

-   cache public catalog reads deliberately
-   invalidate product/category/home tags after admin changes
-   never cache private admin/order/payment responses publicly
-   sold/reserved state must be revalidated server-side during checkout
    regardless of cached storefront state

## Configuration

Store editable business settings in DB where appropriate: - store name -
contact/WhatsApp - bank accounts - homepage banner - SEO defaults Do not
store secrets in DB admin settings if environment variables are more
appropriate.
