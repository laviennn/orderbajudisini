# Checkout Implementation

This document details the implementation of the Phase 4C guest checkout system.

## Security Assumptions

- **Stateless Checkout**: The checkout process does not require user accounts. It relies on a "guest checkout" model.
- **Idempotency**: The `submitCheckout` operation is idempotent. If a duplicate submission occurs with the same idempotency key, it will safely return the existing token without creating a duplicate order.
- **Sealed Tickets**: During the "prepare checkout" phase, the backend responds with a securely sealed, encrypted ticket (using AES-256-GCM) representing the user's cart, shipping quote, and destination. This ticket has an expiry time (typically 24 hours).
- **Tamper Resistance**: If the client modifies the sealed ticket in any way, the decryption or authentication tag check will fail, and the server will reject the checkout attempt with `INVALID_SHIPPING_SELECTION` (mapped to HTTP 400).
- **Secure Token Delivery**: Once the checkout is submitted, the server generates a cryptographically secure `publicToken` and its corresponding `ciphertext` stored in the database. Only the client who successfully submitted the checkout receives this token. It is used to view the order confirmation.

## Token Lifecycle

1. **Prepare**: The client submits items and destination details to `prepareCheckout`. The server creates shipping quotes and issues a `reference` (the encrypted `Ticket`).
2. **Submit**: The client submits the `reference` to `submitCheckout`. The server unseals the ticket. If valid and not expired, the server reserves inventory (using advisory locks or `FOR UPDATE`), inserts records into `customers`, `addresses`, and `orders`, and generates a `publicToken`.
3. **Confirm**: The client uses the `publicToken` to view the order details via the `publicOrder` query on the `/order/[publicToken]` route.
4. **Recovery**: To retrieve the order token if lost, an admin or background job can recover the token using `recoverOrderToken`, which safely unseals the `publicTokenCiphertext` with the correct server secret.

## Order State Machine

The initial order state is `pending_payment`.

- `pending_payment`: Order created, inventory reserved, waiting for manual bank transfer verification.
- `payment_submitted`: (Phase 5) Buyer has uploaded proof of payment.
- `payment_verified`: (Phase 5) Operator has verified the payment.
- `processing`: Order is being packed.
- `shipped`: Order has been handed over to the courier. Tracking number added.
- `completed`: Order received by customer.
- `cancelled`: Order was cancelled (by operator or due to timeout).
- `expired`: Payment was not received within the reservation window (e.g., 30 minutes).
