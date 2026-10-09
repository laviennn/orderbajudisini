# WhatsApp Confirmation

## Overview

After a buyer submits payment proof via the storefront, they are presented with a "Konfirmasi via WhatsApp" button on the order status page (`/order/[publicToken]`). This feature enables buyers to send a pre-formatted message to the store operator to expedite the payment verification process.

## Architecture

1. **Pre-Requisites**:
   - Order must be in `payment_submitted` state.
   - Payment record must be in `submitted` state with a valid `proofObjectKey` and encrypted `proofTokenCiphertext`.
   - Store settings must have a `whatsappNumber` configured.

2. **Client Component (`WhatsAppConfirmation.tsx`)**:
   - Renders a button that performs a `GET` request to the server to securely fetch the WhatsApp URL.
   - Displays appropriate loading and error states without exposing sensitive logic.

3. **Server Endpoint (`/api/order/[publicToken]/whatsapp`)**:
   - Uses `Cache-Control: no-store` to prevent caching of sensitive information.
   - Validates the `publicToken` to authenticate the request against the specific order.
   - Decrypts the `proofTokenCiphertext` to reconstruct the `proofToken`.
   - Formats a detailed message utilizing snapshots from the `orders` and `orderItems` tables to guarantee immutability.
   - Normalizes the `whatsappNumber` to Indonesian `62...` format.
   - Constructs and returns the final `https://wa.me/` URL for redirection.

## Constraints

- **Security**:
  - Payment proofs remain strictly private. The WhatsApp message only contains a signed, temporary `proofUrl` that the operator can access.
  - The endpoint prevents unauthorized access by enforcing the `publicToken` authorization model.
- **Data Integrity**:
  - The WhatsApp message must only reflect the persisted snapshot data (e.g., `orders.addressSnapshot`, `orderItems.priceSnapshot`) and not mutable live catalog data.
- **Testing**:
  - Validated by unit and integration tests under `tests/integration/whatsapp.test.ts`.
  - Smoke tested in `e2e/payment-proof.spec.ts`.
