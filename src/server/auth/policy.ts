import { AppError } from "@/lib/errors";
export const permissionKeys = [
  "admin.access",
  "products.read",
  "products.create",
  "products.update",
  "products.publish",
  "products.archive",
  "categories.read",
  "categories.write",
  "media.read",
  "media.write",
  "orders.read",
  "orders.update",
  "payments.read",
  "payments.verify",
  "reviews.read",
  "reviews.moderate",
  "shipments.read",
  "shipments.update",
  "content.read",
  "content.write",
  "seo.read",
  "seo.manage",
  "operators.read",
  "operators.manage",
  "settings.read",
  "settings.manage",
  "audit.read",
  "promotions.read",
  "promotions.manage",
] as const;
export type Permission = (typeof permissionKeys)[number];
export type Principal = {
  id: string;
  status: "active" | "inactive";
  permissions: readonly string[];
};
export const defaultRoles = {
  Owner: permissionKeys,
  "Catalog Operator": [
    "admin.access",
    "products.read",
    "products.create",
    "products.update",
    "products.publish",
    "products.archive",
    "categories.read",
    "categories.write",
    "media.read",
    "media.write",
    "reviews.read",
    "reviews.moderate",
    "promotions.read",
  ],
  "Order Operator": [
    "admin.access",
    "orders.read",
    "orders.update",
    "payments.read",
    "payments.verify",
    "shipments.read",
    "shipments.update",
  ],
} satisfies Record<string, readonly Permission[]>;
export const hasPermission = (
  principal: Principal | null,
  permission: Permission,
) =>
  Boolean(
    principal?.status === "active" &&
    principal.permissions.includes(permission),
  );
export function assertPermission(
  principal: Principal | null,
  permission: Permission,
): asserts principal is Principal {
  if (!principal) throw new AppError("UNAUTHENTICATED");
  if (!hasPermission(principal, permission)) throw new AppError("FORBIDDEN");
}
