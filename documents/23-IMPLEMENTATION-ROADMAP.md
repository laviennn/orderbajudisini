# Implementation Roadmap

## Phase 0 --- Foundation

-   repository
-   Next.js/TypeScript
-   Tailwind/design tokens
-   lint/format/test
-   env validation
-   DB + Drizzle
-   auth skeleton
-   R2 adapter
-   application shell

## Phase 1 --- Catalog

-   schema/migrations
-   admin product CRUD
-   categories
-   media upload
-   storefront listing
-   product detail
-   sold state
-   product reviews display/moderation
-   responsive QA

## Phase 2 --- Checkout & Orders

-   customer/address
-   shipping adapter
-   checkout
-   transactional order creation
-   reservation
-   order admin
-   order timeline/history

## Phase 3 --- Payment

-   bank settings
-   payment instructions
-   private proof upload
-   payment admin queue
-   verify/reject
-   WhatsApp confirmation link

## Phase 4 --- Shipping & Tracking

-   shipment admin
-   tracking number
-   public tracking flow
-   customer-safe timeline

## Phase 5 --- Operators

-   roles/permissions
-   create/invite operator
-   authorization enforcement
-   audit log

## Phase 6 --- Content & SEO

-   homepage/banner admin
-   global SEO
-   per-product/category SEO
-   metadata
-   sitemap/robots/schema

## Phase 7 --- Analytics Readiness

-   typed event layer
-   GTM/GA4 configuration
-   conversion deduplication
-   privacy review

## Phase 8 --- Hardening

-   E2E tests
-   accessibility
-   performance
-   security review
-   quota monitoring
-   backup/restore docs
-   production launch checklist

## Rule

Do not start visual polish on ten pages while critical
transaction/payment/inventory rules remain undefined. Complete vertical
slices.

## Current delivery status (later user phase numbering)

The original phase numbering above is retained as specification history. Explicit subsequent requests delivered Phase 1A backend foundations and Phase 3 storefront through cart. Admin Product Management/R2 upload pipeline was absent during Phase 3 inspection and is not complete. Checkout, shipping-rate integration and customer order creation are not exposed yet.

Use [the current delivery roadmap](../docs/23-IMPLEMENTATION-ROADMAP.md) and [implementation plan](../docs/IMPLEMENTATION-PLAN.md) for accurate completion status. Recommended next requested phase is Phase 4 Checkout + Shipping Rates + Transactional Order Creation + Inventory Reservation + Final Server-Side Pricing; do not begin it automatically.
