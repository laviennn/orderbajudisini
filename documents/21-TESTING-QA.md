# Testing & QA

## Test Layers

### Unit

-   money calculations
-   order status transition rules
-   SEO fallback generation
-   shipping normalization
-   permissions
-   reservation expiry logic

### Integration

-   transactional order creation
-   inventory conflict
-   payment submit/verify/reject
-   R2 upload authorization
-   admin authorization
-   review moderation

### E2E Critical Paths

1.  browse → product → checkout → order
2.  upload payment proof
3.  operator verifies payment
4.  operator ships order
5.  customer tracks order
6.  admin creates/publishes product
7.  admin creates restricted operator
8.  operator denied forbidden action
9.  sold/reserved product cannot be double-sold
10. SEO edit appears in rendered metadata

## Responsive QA

At minimum test: - 360×800 - 390×844 - 768×1024 - 1366×768 - 1440×900

## Accessibility QA

-   keyboard flow
-   focus visibility
-   labels/errors
-   contrast
-   alt text
-   dialogs
-   reduced motion

## Performance QA

-   no unbounded product query
-   no huge original image delivery
-   no unnecessary client bundle
-   no N+1 review/image queries
-   Lighthouse/Web Vitals used as diagnostics, not vanity scores

## Security QA

-   unauthorized admin API calls rejected
-   private proof URL not public
-   tracking cannot enumerate orders trivially
-   upload rejects invalid/oversized file
-   server ignores client-manipulated totals
