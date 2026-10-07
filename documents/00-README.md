# Thrift Commerce --- Codex Documentation Pack

## Purpose

This repository specification defines a production-minded,
zero-subscription-first e-commerce website for selling secondhand
clothing. It is written for implementation by Codex or another coding
agent and is authoritative unless superseded by a later explicit product
decision.

## Product Principles

1.  **Human-designed, not AI-slop.** Every screen must have deliberate
    hierarchy, spacing, typography, states, and responsive behavior.
2.  **Mobile-first commerce.** Most purchase flows must be excellent on
    360--430 px devices.
3.  **Fast under campaign traffic.** Product media must not depend on
    database egress. Images are delivered from Cloudflare R2/public
    media domain.
4.  **No customer account required.** Checkout and tracking work using
    order number plus customer verification data.
5.  **Manual payment is first-class.** Bank transfer + payment proof +
    WhatsApp confirmation are intentional product flows, not hacks.
6.  **Admin must be usable by non-technical operators.**
7.  **SEO and analytics-ready from day one.**
8.  **Free-tier-first, not "free forever."** Architecture must scale
    without a rewrite if the store grows.

## Locked Baseline Stack

-   Next.js (App Router) + TypeScript
-   Tailwind CSS
-   shadcn/ui primitives where useful; do not make the site look like a
    default shadcn demo
-   PostgreSQL on Neon
-   Drizzle ORM + Drizzle migrations
-   Zod validation
-   React Hook Form for complex client forms
-   Cloudflare R2 for product images and private payment proofs
-   Auth.js for admin/operator authentication
-   Vercel deployment
-   Shipping provider behind an adapter interface
-   GA4/GTM-ready event layer
-   Manual bank transfer; no payment gateway in MVP

## Documentation Map

-   `01-PRD.md` --- business/product requirements
-   `02-INFORMATION-ARCHITECTURE.md` --- routes, sitemap, navigation
-   `03-USER-FLOWS.md` --- customer/operator flows
-   `04-UI-UX-GUIDELINES.md` --- detailed interface rules
-   `05-DESIGN-SYSTEM.md` --- visual system and tokens
-   `06-TECH-STACK.md` --- technology decisions
-   `07-SYSTEM-ARCHITECTURE.md` --- runtime architecture
-   `08-DATABASE-SCHEMA.md` --- data model
-   `09-BACKEND-API.md` --- server actions/API contracts
-   `10-ADMIN-OPERATOR.md` --- admin, operators, permissions
-   `11-PRODUCT-CATALOG.md` --- products, media, inventory, reviews
-   `12-CHECKOUT-ORDERS.md` --- checkout/order state machine
-   `13-PAYMENT.md` --- bank transfer and proof flow
-   `14-SHIPPING-TRACKING.md` --- shipping abstraction and tracking
-   `15-SEO.md` --- editable metadata and basic technical SEO
-   `16-ANALYTICS-ADS.md` --- future Google Ads/GA4 readiness
-   `17-SECURITY.md` --- security/privacy requirements
-   `18-PERFORMANCE-MEDIA.md` --- R2/media/performance strategy
-   `19-CODING-GUIDELINES.md` --- engineering conventions
-   `20-ANTI-AI-SLOP.md` --- strict quality gate
-   `21-TESTING-QA.md` --- acceptance and testing
-   `22-ENV-DEPLOYMENT.md` --- environment/deployment
-   `23-IMPLEMENTATION-ROADMAP.md` --- build sequence
-   `24-DEFINITION-OF-DONE.md` --- release gate

## Codex Operating Rule

Before coding a feature: 1. Read this README. 2. Read the relevant
domain documents. 3. Inspect existing implementation and reuse
established patterns. 4. Do not silently invent business rules,
providers, credentials, fees, bank data, courier data, product content,
or SEO copy. 5. If a missing decision blocks correctness, create a
clearly marked configuration/TODO instead of fabricating data.
