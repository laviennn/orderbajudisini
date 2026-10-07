# UI/UX Guidelines

## Design Direction

The storefront should feel like a curated contemporary thrift shop:
editorial, restrained, product-first, trustworthy. Avoid generic
"startup SaaS", marketplace clutter, excessive gradients, glassmorphism,
random blobs, giant rounded cards, fake badges, and over-animation.

## Hierarchy

1.  Product imagery is the primary visual asset.
2.  Product name/price/availability are next.
3.  Supporting metadata must be scannable.
4.  Promotional content never competes with buying information.

## Homepage

-   Header must not dominate viewport.
-   Hero has one clear purpose and maximum one primary CTA.
-   Banner imagery/text must be editable in admin.
-   New arrivals should appear early.
-   Product grid must feel consistent despite mixed source photography.
-   Trust information is concise and factual.

## Product Cards

Show only: - image - product name - price - optional size -
availability/sold label Optional wishlist is out of MVP unless
explicitly added. Do not show condition, category, brand, multiple
badges, rating, shipping, discount, and CTA simultaneously unless
research proves necessary.

## Product Detail

Desktop: gallery + purchase information split. Mobile: gallery first,
then critical purchase data. Above fold should answer: - what is it? -
how much? - is it available? - what size? - what condition? - how do I
buy?

Measurements must use clear labels and units. Defects must not be hidden
in accordions by default when materially relevant. Reviews appear after
core product/condition information, before or near related products.

## Forms

-   Visible labels; placeholders do not replace labels.
-   Inline validation.
-   Preserve valid input after errors.
-   Correct mobile keyboard/input types.
-   Address fields grouped logically.
-   Shipping calculation has loading, success, empty and error states.
-   Disable duplicate submissions.
-   Always show final total before order creation.

## Payment UX

Payment page must clearly show: - order number - amount - bank - account
number - account holder - payment deadline if used - upload status -
what happens next Copy buttons may be provided for account
number/amount.

## Tracking UX

Use status timeline but keep language understandable: Order received →
Payment verified → Processing → Shipped → Completed. Map internal
statuses to customer-friendly labels.

## Admin UX

Admin prioritizes speed over visual flourish. - tables with
search/filter/status - bulk actions only where safe - clear destructive
confirmation - autosave is not assumed - save/publish state explicit -
image uploader supports progress/retry/reorder - order detail shows
timeline + actions + payment proof + shipping

## Responsive Breakpoints

Design from 360 px upward. Minimum targets: - mobile: 360--767 - tablet:
768--1023 - desktop: 1024+ Use content-driven layout rather than
breakpoint hacks.

## Accessibility

-   semantic HTML
-   keyboard accessible controls
-   visible focus
-   sufficient contrast
-   alt text workflow for product media
-   form errors associated with fields
-   buttons have action labels
-   icons do not carry meaning alone
-   respect reduced motion

## Empty/Error/Loading States

Every data screen must define: - loading - empty - error - success -
unavailable/permission denied where relevant Skeletons should resemble
actual layout; do not use decorative skeleton overload.
