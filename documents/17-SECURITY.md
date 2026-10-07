# Security & Privacy

## Authentication

-   admin/operator only
-   secure session cookies
-   HTTPS
-   server-side session verification
-   rate-limit login
-   no client-only authorization

## Authorization

Every admin mutation checks explicit permission. Hiding a button is not
authorization.

## Input

-   Zod server validation
-   sanitize/escape user-generated review content
-   validate URLs
-   reject unexpected file types
-   prevent mass assignment

## Files

-   product images: public
-   payment proofs: private
-   signed proof URLs short-lived
-   random object keys
-   size/MIME limits
-   do not trust file extension alone

## Orders

-   public order number is not a secret
-   private status/payment access requires secure token or verification
    field
-   use timing/error responses that do not make order enumeration easy
-   rate-limit tracking attempts

## Secrets

Environment variables only for: - DB connection - Auth secret - R2
credentials - shipping API credentials - analytics IDs where appropriate
Never commit `.env`.

## Admin Safety

-   confirmation for destructive actions
-   audit sensitive mutations
-   protect last active owner/admin from accidental lockout where
    practical

## Privacy

Collect only data necessary for fulfillment. Define retention for
payment proofs/customer data with client before production.
