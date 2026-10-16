# Checkout & Orders

## Checkout Philosophy

Short, transparent, no account requirement. The server is authoritative
for all commercial values.

## Fields

-   full name
-   WhatsApp/phone
-   email optional unless business requires it
-   recipient name if different
-   address
-   province
-   city/regency
-   district
-   subdistrict optional/provider dependent
-   postal code
-   shipping option
-   customer note optional

## Total Calculation & Bundle Pricing

``` txt
authoritative unit price = Rp 50.000 / pcs
bundle price = (floor(quantity / 3) * 100.000) + ((quantity % 3) * 50.000)

shipping:
  if quantity == 1: flat Rp 30.000
  if quantity >= 2: flat Rp 0 (Bebas / Gratis Ongkir)

grand_total = bundle_price + shipping
```

Examples:
- 1 pcs: Rp 50.000 + Rp 30.000 (ongkir) = Rp 80.000
- 2 pcs: Rp 100.000 + Rp 0 (gratis ongkir) = Rp 100.000
- 3 pcs: Rp 100.000 + Rp 0 (gratis ongkir) = Rp 100.000 (item ke-3 gratis)
- 4 pcs: Rp 150.000 + Rp 0 (gratis ongkir) = Rp 150.000
- 6 pcs: Rp 200.000 + Rp 0 (gratis ongkir) = Rp 200.000

## Multi-Photo Selection (Photo-as-Item)

In thrift collections/drops where multiple garments are displayed as separate photos:
- Each selected photo (Baju #01, Baju #02, etc.) acts as an independent line item in the cart.
- Each photo line item increments the cart quantity count, driving bundle pricing and the flat/free shipping rule.


## Reservation Strategy

For one-off thrift inventory, use transactional reservation at order
creation. Configurable reservation TTL, e.g. 30--60 minutes, should be a
business setting, not magic UI text. Expired unpaid reservations can be
released by: - scheduled job/cron within provider limits, or - lazy
expiration check during relevant requests plus scheduled cleanup.
Implementation must be idempotent.

## State Transitions

Allowed transitions should be centralized:

``` txt
pending_payment → payment_submitted
pending_payment → expired/cancelled
payment_submitted → payment_verified
payment_submitted → pending_payment (rejected proof/retry) OR cancelled
payment_verified → processing
processing → shipped
shipped → completed
```

No arbitrary status dropdown that allows impossible jumps.

## Order Number

Human-readable, non-secret identifier, e.g. `ORD-20261007-AB12`. Do not
use it alone as authorization to private order data; use verification or
secure token.

## WhatsApp

Generate URL/message from server-safe order information: - store
WhatsApp number from settings - order number - confirmation statement Do
not put full address/payment proof URLs in WhatsApp query parameters.
