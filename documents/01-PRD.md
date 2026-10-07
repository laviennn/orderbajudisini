# Product Requirements Document (PRD)

## 1. Product Summary

A storefront for one-off and limited-stock secondhand clothing.
Customers browse products, inspect detailed
condition/measurements/reviews, submit an order, select shipping,
transfer manually, upload proof, optionally confirm through WhatsApp,
and track the order. Staff manage products, inventory, orders, payment
verification, shipping, reviews, operators, and basic SEO through an
admin dashboard.

## 2. Business Goals

-   Allow client to sell thrift/secondhand clothing without marketplace
    fees or payment gateway dependency.
-   Make catalog management simple for non-technical staff.
-   Preserve performance when product count and campaign traffic grow.
-   Support organic acquisition with indexable product/category pages.
-   Be ready for Google Ads conversion measurement without redesigning
    checkout.
-   Keep initial infrastructure inside free tiers where practical.

## 3. Non-Goals for MVP

-   Marketplace/multiple sellers.
-   Customer account system.
-   Online card/e-wallet payment gateway.
-   Loyalty points.
-   Complex warehouse management.
-   Multi-currency.
-   Native mobile application.
-   Live chat.
-   Automated WhatsApp Business API messaging.
-   AI-generated product descriptions/reviews.

## 4. Personas

### Shopper

Needs fast browsing, clear sizing/condition, trustworthy defect
disclosure, simple checkout, transfer instructions, and order tracking.

### Owner/Admin

Full access to store configuration, products, operators, orders,
payments, SEO, reviews, and reporting.

### Operator

Day-to-day staff with restricted permissions. Typical work: upload
products, update orders, verify payments, enter tracking numbers,
moderate reviews.

## 5. Core Customer Features

### Home

-   Announcement/header area if configured.
-   Hero/banner controlled by admin.
-   New arrivals.
-   Featured products.
-   Category navigation.
-   Optional curated collection.
-   Trust/information section: condition transparency, shipping/payment
    process.
-   Optional reviews/testimonials section using real approved data only.
-   Footer with store info, policies, contact, social links.

### Catalog

-   Product grid.
-   Search.
-   Category filter.
-   Size filter.
-   condition filter.
-   price range.
-   availability filter.
-   sorting: newest, price ascending/descending.
-   pagination or cursor-based "load more"; avoid unbounded rendering.

### Product Detail

Required: - Product title. - price and optional compare-at/original
price if legitimately supplied. - availability. - image gallery. -
category/brand where available. - size label. - detailed measurements. -
condition grade + textual condition notes. - disclosed defects and
defect images. - description. - shipping/ordering note. - CTA. - product
reviews section. - related products. - breadcrumb. - sold state without
immediately destroying URL.

### Checkout

-   No account required.
-   Customer identity/contact.
-   complete address.
-   shipping service/rate selection.
-   order summary.
-   consent/acknowledgement.
-   server-side revalidation of product availability and totals.
-   creation of immutable order snapshot.

### Payment

-   Show configured bank account(s).
-   Amount to transfer.
-   order number.
-   proof upload.
-   payment status.
-   WhatsApp confirmation button using generated message.
-   payment proof is private.

### Tracking

-   Search by order number + verification field (phone/other configured
    field).
-   timeline/status.
-   courier/service.
-   tracking number when available.
-   external tracking link only when safely configured.

## 6. Admin Features

-   Secure admin login.
-   Dashboard overview.
-   Product CRUD.
-   Product media upload/reorder/delete.
-   Categories.
-   Inventory/status.
-   Orders.
-   Payment verification/rejection.
-   Shipping/tracking update.
-   Reviews moderation.
-   Operators and role/permission management.
-   Homepage/banner configuration.
-   Store settings.
-   Bank/payment settings.
-   Basic SEO settings including global title/description and
    per-page/product/category metadata.
-   Audit trail for sensitive admin actions.

## 7. Product Lifecycle

Recommended product states: - `draft` - `active` - `reserved` - `sold` -
`archived`

A product with one unit cannot be sold to multiple orders. Reservation
logic must be transactional.

## 8. Order Lifecycle

Canonical statuses: - `pending_payment` - `payment_submitted` -
`payment_verified` - `processing` - `shipped` - `completed` -
`cancelled` - `expired`

Do not infer payment success from proof upload. Only verification
changes it to `payment_verified`.

## 9. Review Requirements

Reviews belong to products and have moderation. Recommended fields: -
display name - rating 1--5 - review body - optional order reference
internally - status: pending/approved/rejected - created timestamp Only
approved reviews are public. Never generate fake reviews.

## 10. Success Metrics

Prepare event/data model for: - product views - product CTR from
listing - begin checkout - order creation - payment proof submission -
payment verified/purchase - conversion rate - average order value - top
products/categories Do not expose sensitive customer information to
analytics.

## 11. Constraints

-   Initial subscription target: zero paid subscriptions.
-   Deploy on Vercel.
-   Product images must not be stored in PostgreSQL.
-   Avoid coupling media delivery to database provider.
-   Provider quotas must be observable.
-   Architecture must permit future paid scaling without major rewrite.
