import { timestamp, uuid, bigint, check } from "drizzle-orm/pg-core";
import { sql, type SQLWrapper } from "drizzle-orm";
export const id = () => uuid("id").defaultRandom().primaryKey();
export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
export const at = (name: string) => timestamp(name, { withTimezone: true });
export const amount = (name: string) =>
  bigint(name, { mode: "number" }).notNull();
export const moneyCheck = (name: string, column: SQLWrapper) =>
  check(name, sql`${column} between 0 and 9007199254740991`);
