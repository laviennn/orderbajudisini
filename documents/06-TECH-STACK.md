# Tech Stack

## Application

**Next.js App Router + TypeScript** - Server Components by default. -
Client Components only for browser interaction/state. - Server Actions
or route handlers for mutations based on security/cache needs. - Keep
domain logic outside React components.

## Database

**Neon PostgreSQL** - relational source of truth - transactions for
inventory/order creation - no image binary storage

## ORM

**Drizzle ORM** - schema in source control - migrations committed - no
production schema drift through ad-hoc changes

## Media

**Cloudflare R2** - public bucket/domain for product media - private
access for payment proofs - store object keys/metadata in database, not
file bytes

## Authentication

**Auth.js** for admin/operator only. Authorization is application-level
RBAC and must be checked server-side.

## Validation

**Zod** at every trust boundary. Client validation improves UX; server
validation is authoritative.

## Forms

React Hook Form for complex forms. Simple forms can use native/server
patterns.

## Styling

Tailwind CSS + semantic CSS variables. shadcn/ui is a primitive source,
not the visual identity.

## Shipping

Provider adapter:

``` ts
interface ShippingProvider {
  getDestinations(query: string): Promise<Destination[]>
  getRates(input: RateRequest): Promise<ShippingRate[]>
  getTracking?(trackingNumber: string): Promise<TrackingResult>
}
```

No shipping vendor-specific logic inside UI components.

## Analytics

Create internal typed analytics wrapper. GTM/GA4 can be enabled through
configuration.

## Why This Separation

-   Vercel: application
-   Neon: relational data
-   R2: heavy media This prevents product image bandwidth from consuming
    database storage/egress quotas and makes scaling independent.
