# Backend/API Specification

## General Rules

-   Mutations authenticated/authorized where admin-only.
-   Zod-validate all input.
-   Rate-limit sensitive public actions.
-   Return typed domain errors.
-   Never trust client totals, prices, shipping price, product status,
    or role.
-   Log sensitive administrative mutations without storing secrets.

## Public Operations

### Catalog

-   list products with filters/pagination
-   get product by slug
-   list approved reviews
-   related products

### Shipping

`POST /api/shipping/rates` Input: destination, cart/order context.
Server recalculates weight/required data and calls provider adapter. Do
not accept arbitrary final shipping cost from browser.

### Order Creation

`POST /api/orders` Server: 1. validate customer/address 2. fetch
authoritative products 3. lock/check inventory 4. validate shipping
quote or recalculate 5. calculate totals 6. create
customer/address/order/order_items 7. reserve/sell inventory according
to configured policy 8. create payment record 9. commit transaction 10.
return order number + secure public token

### Payment Proof

Prefer signed direct upload: 1. browser requests upload authorization 2.
server validates order/token/file metadata 3. signed upload to private
R2 4. client confirms completion 5. server verifies object
metadata/existence 6. payment → submitted; order → payment_submitted

Do not stream large files through Next.js if direct signed upload is
practical.

### Tracking

`POST /api/orders/track` Input: order number + verification field.
Output only safe customer-facing order data.

## Admin Operations

### Products

-   create draft
-   update
-   publish/unpublish
-   archive
-   mark sold if authorized
-   generate signed media upload
-   attach/reorder/remove images
-   edit SEO fields

### Orders

-   list/filter/search
-   detail
-   update allowed statuses
-   cancel/expire
-   add internal note if implemented

### Payments

-   queue submitted proofs
-   inspect signed private proof URL
-   verify
-   reject with reason Verification must be idempotent and audited.

### Reviews

-   list pending
-   approve
-   reject
-   optional create manual/imported review only if business has
    legitimate source; UI must not encourage fabricated reviews.

### Operators

-   create/invite
-   change role
-   deactivate/reactivate
-   reset auth flow
-   never allow an operator to escalate privileges without
    `operators.manage`.

### SEO/Content

-   update global metadata
-   update banner/home content
-   update product/category SEO

## Error Shape

Use consistent application errors:

``` ts
type ApiError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
}
```

Do not leak SQL/provider stack traces to users.
