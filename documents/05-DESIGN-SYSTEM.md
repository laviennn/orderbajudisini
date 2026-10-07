# Design System

## Philosophy

Create a bespoke store identity through typography, spacing, imagery and
restrained tokens. Do not hardcode a "trendy" palette before brand
assets exist. Implement semantic tokens so branding can change
centrally.

## Semantic Color Tokens

``` css
--background
--foreground
--surface
--surface-subtle
--border
--muted
--muted-foreground
--primary
--primary-foreground
--accent
--accent-foreground
--success
--warning
--danger
--focus-ring
```

Never scatter raw hex values through components.

## Typography

Use at most two font families. Define: - display - h1 - h2 - h3 - body -
body-small - label - caption Avoid enormous hero type that reduces
commerce usability.

## Spacing

Use a consistent 4px-derived scale. Prefer deliberate whitespace over
borders and card containers everywhere.

## Radius

Use a restrained radius scale. Do not make every container a 24--32px
pill/rounded rectangle.

## Shadows

Minimal. Product imagery should not require neon/glow/shadow effects.

## Layout

-   global max-width token
-   consistent page gutters
-   product grids adapt by available width
-   readable text line lengths
-   admin may use denser spacing than storefront

## Components

Core: - Button - IconButton - Input/Textarea/Select - Checkbox/Radio -
Dialog/AlertDialog - Sheet/Drawer - Toast - Badge/StatusBadge -
ProductCard - ProductGrid - Price - ImageGallery - Breadcrumb -
Pagination - EmptyState - ErrorState - OrderTimeline - UploadDropzone -
DataTable - FormField - ConfirmAction

## Motion

150--250ms for ordinary interface transitions. No continuous decorative
animation. Use motion only for feedback, hierarchy or navigation
context.
