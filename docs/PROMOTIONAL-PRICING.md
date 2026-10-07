# Bundle pricing foundation

The supplied promotional-pricing requirements extend the Phase 1A data model. Phase 3 preserves this engine and these explicit policies. The engine and permission-checked campaign service are implemented; cart pricing UI is implemented in Phase 3; campaign administration UI is not. No active production promotion or fake product was seeded.

Products must explicitly opt in through promotionEligible. Campaigns configure required quantity, bundle price in integer IDR, priority, schedule, optional category and optional product targets. No target rows means all opted-in products within the category scope. Campaigns are non-stacking; higher priority wins, then deterministic campaign ID. Each eligible unit participates at most once.

For an explicitly configured 3-for-100000 campaign, eligible counts 1–2 remain normal price; 3 forms one bundle; 4–5 have one bundle plus normal-price remainder; 6 has two bundles; 7 has two bundles plus remainder. Ineligible items always retain normal prices. Tests cover 1–9, mixed eligibility, category/target scope, schedules, variable prices, priorities, rounding and invalid inputs.

## Decisions required before activation

Two business decisions were requested but not answered. They are explicit nullable configuration, and an active campaign cannot omit them:

- Group selection: highest_price_first or lowest_price_first. For 60k + 50k + 45k + 40k, a three-for-100k campaign produces respectively 140k or 160k total.
- Price policy: discount_only skips bundles whose normal total is already at or below bundle price; fixed_bundle applies the advertised fixed price even when it increases that group's price.

There is no silently selected production default. Resolve these choices with the owner before activating a campaign. The latter policy records a separate surcharge instead of a negative discount.

## Calculation and persistence

`src/lib/domain/pricing.ts` is the single calculation engine. Checkout reads locked, current database products/campaigns and calls it through the server pricing service. Client totals are rejected. Results include original subtotal, discount, surcharge, merchandise total, product-line allocations and applied campaign details; shipping is added separately by checkout from a trusted quote.

Integer proportional allocation uses BigInt arithmetic and deterministic largest remainders, so line totals add exactly to the bundle total without floating-point money. Tie-breaking uses stable product IDs/unit positions. Cart inputs are bounded to 100 total units; active campaign/target query bounds fail explicitly instead of silently ignoring rules.

Order items and order_promotions store immutable financial/rule/allocation snapshots. Later product or campaign edits cannot reprice historical orders. PostgreSQL deferred checks verify line totals and promotion effects against the order. Tests exercise a seven-unit campaign, subsequent catalog/campaign edits and forbidden snapshot mutation.
