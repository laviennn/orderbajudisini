import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  uuid,
  integer,
  smallint,
  boolean,
  check,
  index,
  jsonb,
  unique,
  foreignKey,
} from "drizzle-orm/pg-core";
import { orderStates, paymentStates, reviewStates } from "@/lib/domain/states";
import { id, at, amount, createdAt, updatedAt, moneyCheck } from "./shared";
import { users } from "./identity";
import { products } from "./catalog";
export const orderStatus = pgEnum("order_status", orderStates);
export const paymentStatus = pgEnum("payment_status", paymentStates);
export const reviewStatus = pgEnum("review_status", reviewStates);
export const customers = pgTable("customers", {
  id: id(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  createdAt: createdAt(),
});
export const addresses = pgTable(
  "addresses",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    addressLine: text("address_line").notNull(),
    province: text("province").notNull(),
    city: text("city").notNull(),
    district: text("district").notNull(),
    subdistrict: text("subdistrict"),
    postalCode: text("postal_code").notNull(),
    providerDestinationId: text("provider_destination_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("addresses_customer_idx").on(t.customerId),
    unique("address_customer_identity").on(t.id, t.customerId),
  ],
);
export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: id(),
    bankName: text("bank_name").notNull(),
    accountNumber: text("account_number").notNull(),
    accountHolder: text("account_holder").notNull(),
    instructions: text("instructions"),
    logoObjectKey: text("logo_object_key"),
    active: boolean("active").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("bank_number_valid", sql`${t.accountNumber} ~ '^[0-9]{4,40}$'`),
  ],
);
export const qrisSettings = pgTable(
  "qris_settings",
  {
    id: integer("id").primaryKey().default(1),
    merchantName: text("merchant_name"),
    imageObjectKey: text("image_object_key"),
    instructions: text("instructions"),
    active: boolean("active").notNull().default(false),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("qris_singleton", sql`${t.id} = 1`),
    check(
      "qris_active_requires_image",
      sql`${t.active} = false or ${t.imageObjectKey} is not null`,
    ),
  ],
);
export const shippingQuotes = pgTable(
  "shipping_quotes",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    addressId: uuid("address_id")
      .notNull()
      .references(() => addresses.id, { onDelete: "restrict" }),
    cartFingerprint: text("cart_fingerprint").notNull(),
    contextFingerprint: text("context_fingerprint"),
    testOnly: boolean("test_only").notNull().default(false),
    courierName: text("courier_name"),
    serviceName: text("service_name"),
    provider: text("provider").notNull(),
    courier: text("courier").notNull(),
    service: text("service").notNull(),
    cost: amount("cost"),
    etd: text("etd"),
    expiresAt: at("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    moneyCheck("quote_cost_valid", t.cost),
    check(
      "quote_context_valid",
      sql`${t.contextFingerprint} is null or ${t.contextFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    foreignKey({
      name: "quote_address_customer_fk",
      columns: [t.addressId, t.customerId],
      foreignColumns: [addresses.id, addresses.customerId],
    }).onDelete("restrict"),
    index("quote_expiry_idx").on(t.expiresAt),
  ],
);
export type AddressSnapshot = {
  recipientName: string;
  phone: string;
  addressLine: string;
  province: string;
  city: string;
  district: string;
  subdistrict: string | null;
  postalCode: string;
};
export const orders = pgTable(
  "orders",
  {
    id: id(),
    orderNumber: text("order_number").notNull().unique(),
    publicTokenHash: text("public_token_hash").notNull().unique(),
    publicTokenCiphertext: text("public_token_ciphertext"),
    idempotencyKey: uuid("idempotency_key").notNull().unique(),
    requestHash: text("request_hash").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    addressId: uuid("address_id")
      .notNull()
      .references(() => addresses.id, { onDelete: "restrict" }),
    addressSnapshot: jsonb("address_snapshot")
      .$type<AddressSnapshot>()
      .notNull(),
    status: orderStatus("status").notNull().default("pending_payment"),
    subtotal: amount("subtotal"),
    discountTotal: amount("discount_total").default(0),
    surchargeTotal: amount("surcharge_total").default(0),
    merchandiseTotal: amount("merchandise_total"),
    shippingCost: amount("shipping_cost"),
    grandTotal: amount("grand_total"),
    currency: text("currency").notNull().default("IDR"),
    shippingQuoteId: uuid("shipping_quote_id")
      .notNull()
      .references(() => shippingQuotes.id, { onDelete: "restrict" })
      .unique(),
    shippingProvider: text("shipping_provider").notNull(),
    shippingCourier: text("shipping_courier").notNull(),
    shippingService: text("shipping_service").notNull(),
    shippingEtd: text("shipping_etd"),
    paymentDueAt: at("payment_due_at").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    moneyCheck("orders_subtotal_valid", t.subtotal),
    foreignKey({
      name: "order_address_customer_fk",
      columns: [t.addressId, t.customerId],
      foreignColumns: [addresses.id, addresses.customerId],
    }).onDelete("restrict"),
    moneyCheck("orders_discount_valid", t.discountTotal),
    moneyCheck("orders_surcharge_valid", t.surchargeTotal),
    moneyCheck("orders_merchandise_valid", t.merchandiseTotal),
    moneyCheck("orders_shipping_valid", t.shippingCost),
    moneyCheck("orders_total_valid", t.grandTotal),
    check(
      "orders_totals_consistent",
      sql`${t.discountTotal} <= ${t.subtotal} and ${t.merchandiseTotal} = ${t.subtotal} - ${t.discountTotal} + ${t.surchargeTotal} and ${t.grandTotal} = ${t.merchandiseTotal} + ${t.shippingCost}`,
    ),
    check("orders_currency_idr", sql`${t.currency} = 'IDR'`),
    check(
      "orders_token_hash_valid",
      sql`${t.publicTokenHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "orders_token_envelope_valid",
      sql`${t.publicTokenCiphertext} is null or ${t.publicTokenCiphertext} ~ '^v1[.][a-f0-9]{24}[.][a-f0-9]{32}[.][a-f0-9]{64}$'`,
    ),
    index("orders_status_created_idx").on(t.status, t.createdAt),
    index("orders_expiry_idx").on(t.status, t.paymentDueAt),
    index("orders_customer_idx").on(t.customerId),
  ],
);
export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    skuSnapshot: text("sku_snapshot").notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    slugSnapshot: text("slug_snapshot").notNull(),
    priceSnapshot: amount("price_snapshot"),
    sizeSnapshot: text("size_snapshot"),
    conditionSnapshot: text("condition_snapshot").notNull(),
    imageSnapshot: text("image_snapshot"),
    quantity: integer("quantity").notNull(),
    originalLineTotal: amount("original_line_total"),
    discountTotal: amount("discount_total").default(0),
    surchargeTotal: amount("surcharge_total").default(0),
    lineTotal: amount("line_total"),
  },
  (t) => [
    moneyCheck("items_price_valid", t.priceSnapshot),
    moneyCheck("items_line_valid", t.lineTotal),
    moneyCheck("items_discount_valid", t.discountTotal),
    moneyCheck("items_surcharge_valid", t.surchargeTotal),
    check(
      "items_totals_consistent",
      sql`${t.quantity} > 0 and ${t.originalLineTotal} = ${t.priceSnapshot} * ${t.quantity} and ${t.lineTotal} = ${t.originalLineTotal} - ${t.discountTotal} + ${t.surchargeTotal} and ${t.discountTotal} <= ${t.originalLineTotal}`,
    ),
    index("items_order_idx").on(t.orderId),
    index("items_product_idx").on(t.productId),
  ],
);
export type BundleAllocation = {
  productId: string;
  quantity: number;
  total: number;
};
export const orderPromotions = pgTable(
  "order_promotions",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    promotionIdSnapshot: uuid("promotion_id_snapshot").notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    requiredQuantitySnapshot: integer("required_quantity_snapshot").notNull(),
    bundlePriceSnapshot: amount("bundle_price_snapshot"),
    bundleCount: integer("bundle_count").notNull(),
    discountAmount: amount("discount_amount"),
    surchargeAmount: amount("surcharge_amount").default(0),
    allocationStrategySnapshot: text("allocation_strategy_snapshot").notNull(),
    pricePolicySnapshot: text("price_policy_snapshot").notNull(),
    allocations: jsonb("allocations").$type<BundleAllocation[]>().notNull(),
  },
  (t) => [
    index("order_promotions_order_idx").on(t.orderId),
    check(
      "order_promotions_quantity_valid",
      sql`${t.bundleCount} > 0 and ${t.requiredQuantitySnapshot} >= 2`,
    ),
    moneyCheck("order_promotions_discount_valid", t.discountAmount),
    moneyCheck("order_promotions_surcharge_valid", t.surchargeAmount),
  ],
);
export const reservationStatus = pgEnum("reservation_status", [
  "reserved",
  "released",
  "sold",
]);
export const reservations = pgTable(
  "reservations",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    status: reservationStatus("status").notNull().default("reserved"),
    expiresAt: at("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("reservation_order_product_unique").on(t.orderId, t.productId),
    check("reservation_quantity_positive", sql`${t.quantity} > 0`),
    index("reservation_product_status_idx").on(t.productId, t.status),
    index("reservation_expiry_idx").on(t.status, t.expiresAt),
  ],
);
export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" })
      .unique(),
    method: text("method").notNull().default("bank_transfer"),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
      onDelete: "restrict",
    }),
    bankSnapshot: jsonb("bank_snapshot").$type<{
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      instructions?: string | null;
    }>(),
    qrisSnapshot: jsonb("qris_snapshot").$type<{
      merchantName?: string | null;
      imageObjectKey: string;
      instructions?: string | null;
    }>(),
    expectedAmount: amount("expected_amount"),
    status: paymentStatus("status").notNull().default("pending"),
    proofTokenHash: text("proof_token_hash").unique(),
    proofTokenCiphertext: text("proof_token_ciphertext"),
    proofObjectKey: text("proof_object_key"),
    proofMime: text("proof_mime"),
    proofBytes: integer("proof_bytes"),
    submittedAt: at("submitted_at"),
    verifiedAt: at("verified_at"),
    verifiedBy: uuid("verified_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    rejectionReason: text("rejection_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    moneyCheck("payment_amount_valid", t.expectedAmount),
    check(
      "payment_method_valid",
      sql`${t.method} in ('bank_transfer', 'qris')`,
    ),
    check(
      "payment_proof_private",
      sql`${t.proofObjectKey} is null or (${t.proofObjectKey} like 'payment-proof/%' and ${t.proofObjectKey} not like '%..%')`,
    ),
    check(
      "payment_submission_valid",
      sql`${t.status} = 'pending' or (${t.proofObjectKey} is not null and ${t.proofMime} is not null and ${t.proofBytes} is not null and ${t.proofBytes} > 0 and ${t.submittedAt} is not null)`,
    ),
    check(
      "payment_verification_valid",
      sql`${t.status} <> 'verified' or (${t.verifiedBy} is not null and ${t.verifiedAt} is not null)`,
    ),
    check(
      "payment_rejection_valid",
      sql`${t.status} <> 'rejected' or (${t.rejectionReason} is not null and length(trim(${t.rejectionReason})) > 0)`,
    ),
    index("payments_status_submitted_idx").on(t.status, t.submittedAt),
  ],
);
export const shipments = pgTable(
  "shipments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" })
      .unique(),
    courier: text("courier").notNull(),
    service: text("service").notNull(),
    trackingNumber: text("tracking_number"),
    status: text("status").notNull().default("pending"),
    shippedAt: at("shipped_at"),
    deliveredAt: at("delivered_at"),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "shipment_state_valid",
      sql`${t.status} in ('pending','shipped','delivered')`,
    ),
    check(
      "shipment_tracking_required",
      sql`${t.status} = 'pending' or (${t.trackingNumber} is not null and length(trim(${t.trackingNumber})) > 0 and ${t.shippedAt} is not null)`,
    ),
  ],
);
export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    note: text("note"),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("order_history_order_created_idx").on(t.orderId, t.createdAt)],
);
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "restrict",
    }),
    reviewerName: text("reviewer_name").notNull(),
    rating: smallint("rating").notNull(),
    body: text("body").notNull(),
    status: reviewStatus("status").notNull().default("pending"),
    moderatedBy: uuid("moderated_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    moderatedAt: at("moderated_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("review_rating_range", sql`${t.rating} between 1 and 5`),
    check(
      "review_moderation_required",
      sql`${t.status} = 'pending' or (${t.moderatedBy} is not null and ${t.moderatedAt} is not null)`,
    ),
    index("reviews_product_status_created_idx").on(
      t.productId,
      t.status,
      t.createdAt,
    ),
    index("reviews_moderation_queue_idx").on(t.status, t.createdAt),
  ],
);
// Only the future trusted upload-validation pipeline may issue these receipts.
export const paymentProofReceipts = pgTable(
  "payment_proof_receipts",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    objectKey: text("object_key").notNull().unique(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    validatedAt: at("validated_at").notNull(),
    expiresAt: at("expires_at").notNull(),
    consumedAt: at("consumed_at"),
  },
  (t) => [
    check(
      "proof_receipt_private",
      sql`${t.objectKey} like 'payment-proof/%' and ${t.objectKey} not like '%..%'`,
    ),
    check("proof_receipt_size", sql`${t.bytes} between 1 and 10485760`),
    check(
      "proof_receipt_mime",
      sql`${t.mime} in ('image/jpeg','image/png','image/webp')`,
    ),
    index("proof_receipts_order_idx").on(t.orderId),
  ],
);
