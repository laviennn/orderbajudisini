# Phase 5D: Payment Regression & Analytics

## Verified Payment Conversion Trigger

The authoritative purchase conversion is triggered exclusively when an authorized operator manually verifies a payment proof from the admin dashboard (`/admin/payments/[id]`). Client-side events (such as `payment_proof_submitted` or `whatsapp_opened`) are NOT treated as purchases to ensure high fidelity and avoid false positives.

## Deduplication

To guarantee that multiple verifications, retries, or network issues do not generate duplicate purchase conversions, a deduplication strategy is employed using the database constraint `analytics_outbox_order_id_unique`. Each verified order creates exactly one entry in the outbox. The immutable `order.id` handles this automatically during the database transaction.

## Analytics Delivery Architecture

We are employing a durable pending-event outbox architecture. During the `payment_verified` state transition, a server-authoritative GA4 Measurement Protocol payload is generated and atomically written to the `analytics_outbox` table.

This guarantees:

1. No conversion payloads are lost if the external analytics API is temporarily down.
2. The UI interaction for the operator remains fast as external analytics APIs are bypassed during the critical transaction path.
3. The table can later be dispatched asynchronously (e.g. via a background cron job).

## GA4 / Google Ads Configuration

The payload recorded includes:

- `transaction_id`: The immutable, unique order number.
- `currency`: Forced to IDR.
- `value`: The authoritative `grandTotal` amount.
- `shipping`: Order's `shippingCost`.
- `discount`: Order's `discountTotal`.
- `items`: An array mapping each `skuSnapshot` to the `item_id`, `nameSnapshot` to `item_name`, and its corresponding `price` and `quantity`.

No PII (Personally Identifiable Information) such as customer name, phone, email, or exact address is sent, preserving privacy and adhering to consent policies.

## Private R2 and WhatsApp Security

- The payment proof continues to reside in the private bucket on Cloudflare R2 and is never exposed publicly.
- The signed R2 read URLs for proofs are temporary and securely vended.
- The WhatsApp confirmation link uses persisted snapshots exclusively to generate the message and prevents tampering.

## Test Outcomes

- Successfully passed integration tests for operator payment verification (`tests/integration/payments-admin.test.ts`).
- Admin browser smoke test successfully implemented (`e2e/payment-proof.spec.ts`) asserting full E2E lifecycle (Checkout -> Proof Upload -> Admin Approval -> Customer Views Verified).
- Outbox database constraint deduplication effectively tested.

## GA4 Dispatcher Implementation

The background dispatcher is implemented at `src/server/services/analytics-dispatcher.ts` and runs via a cron job endpoint at `/api/cron/analytics`. It reads `GA4_MEASUREMENT_ID` and `GA4_API_SECRET` from the environment and dispatches batches of 50 pending events to the Google Measurement Protocol.

## Remaining Production Credentials

For the system to deliver the events, the cron-job endpoint must be hit periodically using a service like Vercel Cron, and configured with the `GA4_MEASUREMENT_ID` and `GA4_API_SECRET` in production.

Phase 5D is fully complete.
