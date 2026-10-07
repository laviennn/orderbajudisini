# Analytics & Google Ads Readiness

## Objective

Do not require Ads at launch, but preserve a clean conversion funnel.

## Internal Events

Typed events: - `view_item_list` - `select_item` - `view_item` -
`begin_checkout` - `add_shipping_info` - `order_created` -
`payment_proof_submitted` - `purchase` only when business definition is
satisfied, preferably payment verified

## Purchase Event

Must be deduplicated using order ID/order number and emitted only once
per intended conversion definition.

## Data Layer

Create an internal analytics abstraction so UI does not contain
vendor-specific calls everywhere.

## Privacy

Never send: - full name - phone - email - full address - bank proof URL
to GA4/Google Ads event parameters.

## Campaign Performance

Architecture must withstand landing traffic: - static/cached public
pages where safe - media direct from R2/CDN - bounded catalog queries -
no N+1 database calls - no client-side waterfall for critical product
data
