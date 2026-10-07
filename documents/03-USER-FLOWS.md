# User Flows

## Browse → Purchase

``` txt
Home
→ Category/Product Listing
→ Product Detail
→ Buy Now
→ Checkout Details
→ Shipping Quote
→ Select Shipping
→ Review Order
→ Server validates inventory + totals
→ Create Order + Reserve Item
→ Payment Instructions
→ Transfer
→ Upload Proof
→ Payment Submitted
→ Optional WhatsApp Confirmation
→ Admin Verification
→ Processing
→ Shipped
→ Completed
```

## Inventory Conflict

``` txt
Customer opens available item
→ another customer reserves/sells item
→ first customer submits checkout
→ server transaction detects unavailable item
→ do NOT create payable order
→ explain item is no longer available
→ offer return to product/catalog
```

## Payment Proof

``` txt
Order pending_payment
→ customer uploads JPG/PNG/WebP/PDF if allowed by policy
→ server validates type/size
→ store privately in R2
→ payment record = submitted
→ order = payment_submitted
→ operator reviews
→ verify OR reject/request re-upload
```

## Operator Product Upload

``` txt
Login
→ Products
→ New Product
→ Basic Info
→ Category/Brand
→ Price
→ Size + Measurements
→ Condition + Defects
→ Images
→ Inventory
→ SEO
→ Preview
→ Save Draft / Publish
```

## Operator Creation

``` txt
Admin
→ Operators
→ Create Operator
→ name/email
→ role/permissions
→ issue invitation or credential setup flow
→ operator activates account
→ audit log created
```

Never expose a plaintext password in logs.

## Review Moderation

``` txt
Review received/created
→ pending
→ operator inspects
→ approve/reject
→ approved review becomes public
```

## Order Tracking

``` txt
Track Order
→ order number
→ verification field
→ validate server-side
→ show safe status/timeline
→ never expose payment proof/customer address publicly
```
