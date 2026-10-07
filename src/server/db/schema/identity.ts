import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
  integer,
  boolean,
  check,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { userStates } from "@/lib/domain/states";
import { id, at, createdAt, updatedAt } from "./shared";
export const userStatus = pgEnum("user_status", userStates);
export const roles = pgTable(
  "roles",
  {
    id: id(),
    name: text("name").notNull().unique(),
    description: text("description"),
    isOwner: boolean("is_owner").notNull().default(false),
  },
  (t) => [
    uniqueIndex("roles_one_owner")
      .on(t.isOwner)
      .where(sql`${t.isOwner} = true`),
  ],
);
export const permissions = pgTable("permissions", {
  id: id(),
  key: text("key").notNull().unique(),
  description: text("description"),
});
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    index("role_permissions_permission_idx").on(t.permissionId),
  ],
);
export const users = pgTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"),
    sessionVersion: integer("session_version").notNull().default(0),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    status: userStatus("status").notNull().default("inactive"),
    lastLoginAt: at("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("users_email_normalized", sql`${t.email} = lower(trim(${t.email}))`),
    check("users_session_version_nonnegative", sql`${t.sessionVersion} >= 0`),
    index("users_role_status_idx").on(t.roleId, t.status),
  ],
);
export const loginRateLimits = pgTable(
  "login_rate_limits",
  {
    key: text("key").primaryKey(),
    attempts: integer("attempts").notNull(),
    expiresAt: at("expires_at").notNull(),
  },
  (t) => [
    index("login_rate_limits_expiry_idx").on(t.expiresAt),
    check("rate_limit_attempts_positive", sql`${t.attempts} > 0`),
  ],
);
export const bootstrapState = pgTable(
  "bootstrap_state",
  {
    id: integer("id").primaryKey(),
    completedAt: at("completed_at").notNull().defaultNow(),
  },
  (t) => [check("bootstrap_singleton", sql`${t.id} = 1`)],
);
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    // Typed and allowlisted metadata is encoded as JSON by the audit service.
    metadata: jsonb("metadata_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_actor_created_idx").on(t.actorUserId, t.createdAt),
    index("audit_entity_created_idx").on(t.entityType, t.entityId, t.createdAt),
    check("audit_metadata_object", sql`jsonb_typeof(${t.metadata}) = 'object'`),
  ],
);
