# Anti-AI-Slop Quality Rules

This file is mandatory.

## UI Slop --- Forbidden

Do not: - turn every section into rounded cards - use random
gradients/glows/blobs - use excessive `rounded-2xl/3xl` - use generic
purple SaaS styling without brand basis - add meaningless badges - add
fake metrics/testimonials/reviews - fill empty space with decorative
icons - create oversized hero copy that pushes products below fold - use
5+ font weights without hierarchy - animate everything - copy default
shadcn layouts unchanged - use emojis as production UI icons - invent
brand slogans - invent discount percentages - invent scarcity ("Only 2
left") when stock data does not support it

## Content Slop --- Forbidden

No: - "Elevate your style" - "Discover timeless fashion" - "Premium
quality at affordable prices" - generic marketing filler unless client
explicitly supplies/approves such copy.

Use factual, concise commerce language.

## Code Slop --- Forbidden

Do not: - create abstraction with one meaningless wrapper after
another - add TODOs for core functionality while claiming feature
complete - mock production integrations silently - hardcode
prices/shipping/bank data - duplicate schemas/types unnecessarily -
catch errors and return success - use client state for authoritative
inventory/payment state - put all logic in one route/page - generate
1,000-line components - add dependencies without need - disable
TypeScript/ESLint rules to silence problems - use `any` as escape
hatch - expose secrets to `NEXT_PUBLIC_*`

## Data Slop --- Forbidden

Do not fabricate: - products - customer reviews - order history -
tracking status - bank account - courier rate - analytics results - SEO
claims

Development fixtures must be clearly marked and isolated.

## Quality Test

Before finishing a screen, ask: 1. Does every element serve commerce or
navigation? 2. Is hierarchy obvious in 3 seconds? 3. Is it usable at
360px? 4. Are empty/error/loading states handled? 5. Is text factual? 6.
Could this be mistaken for an untouched template? 7. Does the
implementation preserve server authority/security?

If #6 is yes, redesign/refine.
