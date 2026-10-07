# Definition of Done

A feature is not done because it renders.

## Functional

-   acceptance path works
-   negative/error path works
-   loading/empty states exist
-   server validates input
-   authorization applied
-   database mutation correct and transactional where needed

## UI/UX

-   mobile and desktop checked
-   keyboard usable
-   no overflow/layout shift
-   clear copy
-   no template/AI-slop artifacts
-   visual hierarchy matches design system

## Data

-   migration included
-   indexes considered
-   no fabricated production data
-   timestamps/audit where required

## Security

-   no secrets exposed
-   file access correct
-   permissions server-enforced
-   user data minimized

## Performance

-   bounded query
-   optimized media
-   caching/invalidation considered
-   no obvious N+1

## SEO for Public Pages

-   title/description
-   canonical where applicable
-   semantic heading
-   crawl/index behavior intentional
-   structured data only when truthful

## QA

-   relevant unit/integration/E2E tests
-   lint/typecheck pass
-   no hidden console errors
-   production build passes

## Documentation

Update affected markdown docs when implementation intentionally changes
architecture/business rules.
