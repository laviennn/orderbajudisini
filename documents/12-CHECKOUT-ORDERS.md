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

## Total Calculation

``` txt
subtotal = Σ authoritative item price × quantity
shipping = authoritative selected quote
discount = server-authorized only
grand_total = subtotal + shipping - discount
```

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
