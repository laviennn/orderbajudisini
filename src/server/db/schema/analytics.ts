import { pgTable, text, uuid, jsonb } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt } from "./shared";
import { orders } from "./commerce";

export const analyticsOutbox = pgTable("analytics_outbox", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "restrict" })
    .unique(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
