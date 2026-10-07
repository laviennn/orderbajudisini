# Admin & Operator System

## Roles

Start with: \### Owner/Admin All permissions.

### Catalog Operator

Products/categories/media, limited order read if needed.

### Order Operator

Orders, payment review, shipment updates; no operator management or
global security settings.

Roles should map to permissions rather than hardcoded UI-only checks.

## Operator Management

Admin page must support: - create/invite operator - name/email - role -
active/inactive - last login - created date - change role - deactivate -
credential reset/invitation resend if supported

Every privileged action is checked server-side.

## Dashboard

Useful, not decorative: - active products - sold products - orders
awaiting payment verification - processing orders - recent orders -
low/expired reservations if applicable Avoid fake charts. Only show
charts when backed by real data and useful.

## Product Management

List columns: - thumbnail - SKU - name - category - size - price -
status - updated Actions: edit, preview, duplicate only if explicitly
useful, archive.

Editor sections: 1. Basic info 2. Price 3. Category/brand 4.
Size/measurements 5. Condition/defects 6. Media 7. Inventory/status 8.
SEO 9. Preview/publish

## Payment Menu

Dedicated queue: - order number - customer - amount expected - submitted
time - proof status - actions Detail includes secure proof preview,
expected amount, bank destination, order summary,
verification/rejection.

## SEO Menu

Global: - site title - title template - default meta description -
default social image - indexation controls with safe defaults

Per product/category: - SEO title - meta description - canonical
defaults automatic - SERP preview is optional but useful Do not allow
casual editing of dangerous robots directives without clear warnings.

## Audit

Record: - product publish/archive - payment verification/rejection -
order status changes - tracking changes - operator role/status changes -
SEO/global setting changes
