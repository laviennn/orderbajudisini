# Database Schema

## Core Tables

### users

Admin/operator identity. - id UUID - name - email unique - password_hash
or auth-provider identity fields - role_id - status - last_login_at -
created_at - updated_at

### roles

-   id
-   name unique
-   description

### permissions

-   id
-   key unique (`products.write`, `orders.update`, `payments.verify`,
    `operators.manage`, `seo.manage`)
-   description

### role_permissions

-   role_id
-   permission_id

### categories

-   id
-   name
-   slug unique
-   description nullable
-   status
-   sort_order
-   seo_title nullable
-   seo_description nullable
-   created_at
-   updated_at

### products

-   id UUID
-   sku unique
-   slug unique
-   name
-   short_description nullable
-   description
-   brand nullable
-   category_id
-   price integer/bigint in smallest currency unit
-   compare_at_price nullable
-   currency default IDR
-   size_label nullable
-   condition_grade nullable
-   condition_notes
-   defect_notes nullable
-   status enum draft/active/reserved/sold/archived
-   quantity default 1
-   reserved_until nullable
-   seo_title nullable
-   seo_description nullable
-   published_at nullable
-   created_by
-   updated_by
-   created_at
-   updated_at

### product_measurements

Flexible structured measurements. - id - product_id - key
(`chest_width`, `length`, etc.) - label - value decimal/text - unit -
sort_order

### product_images

-   id UUID
-   product_id
-   object_key
-   public_url or derived URL field only if stable
-   variant/type
-   alt_text
-   width
-   height
-   bytes
-   mime_type
-   sort_order
-   is_defect_image boolean
-   created_at

### customers

-   id UUID
-   name
-   phone
-   email nullable
-   created_at

### addresses

-   id
-   customer_id
-   recipient_name
-   phone
-   address_line
-   province
-   city
-   district
-   subdistrict nullable
-   postal_code
-   provider_destination_id nullable
-   created_at

### orders

-   id UUID
-   order_number unique
-   public_token unique
-   customer_id
-   address_id
-   status
-   subtotal
-   shipping_cost
-   discount_total default 0
-   grand_total
-   currency
-   shipping_provider
-   shipping_service
-   shipping_etd nullable
-   payment_due_at nullable
-   notes nullable
-   created_at
-   updated_at

### order_items

Immutable snapshot. - id - order_id - product_id nullable -
sku_snapshot - name_snapshot - slug_snapshot - price_snapshot -
size_snapshot - condition_snapshot - image_snapshot - quantity -
line_total

### payments

-   id UUID
-   order_id
-   method enum bank_transfer
-   bank_account_id
-   expected_amount
-   status pending/submitted/verified/rejected
-   proof_object_key nullable
-   proof_mime nullable
-   submitted_at nullable
-   verified_at nullable
-   verified_by nullable
-   rejection_reason nullable
-   created_at
-   updated_at

### bank_accounts

-   id
-   bank_name
-   account_number_encrypted_or_protected_as_appropriate
-   account_holder
-   is_active
-   sort_order

### shipments

-   id
-   order_id
-   courier
-   service
-   tracking_number nullable
-   status
-   shipped_at nullable
-   delivered_at nullable
-   updated_by
-   created_at
-   updated_at

### order_status_history

-   id
-   order_id
-   from_status nullable
-   to_status
-   note nullable
-   actor_user_id nullable
-   created_at

### reviews

-   id UUID
-   product_id
-   order_id nullable
-   reviewer_name
-   rating smallint CHECK 1..5
-   body
-   status pending/approved/rejected
-   moderated_by nullable
-   moderated_at nullable
-   created_at
-   updated_at

### banners

-   id
-   title/internal_name
-   headline nullable
-   body nullable
-   image_object_key nullable
-   mobile_image_object_key nullable
-   cta_label nullable
-   cta_url nullable
-   status
-   starts_at nullable
-   ends_at nullable
-   sort_order

### seo_settings

Singleton or scoped key/value: - id - site_title - title_template -
default_description - default_og_image - robots policy fields - social
handles as needed - updated_by - updated_at

### store_settings

-   id
-   store_name
-   whatsapp_number
-   support_email
-   address/display fields
-   checkout/payment configuration
-   updated_at

### audit_logs

-   id
-   actor_user_id
-   action
-   entity_type
-   entity_id
-   metadata_json (never secrets)
-   ip_hash/metadata only if legally appropriate
-   created_at

## Indexes

At minimum: - products(status, published_at) - products(category_id,
status) - products(slug) - orders(order_number) - orders(status,
created_at) - payments(status, submitted_at) - reviews(product_id,
status, created_at) - product_images(product_id, sort_order)

## Transaction Requirement

Order creation + product reservation/stock mutation must execute
atomically. Never trust availability checked only on a previous page
load.
