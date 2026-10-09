import { beforeAll, afterAll, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { startTestDatabase } from "./database";
import * as s from "@/server/db/schema";
let database: Awaited<ReturnType<typeof startTestDatabase>>;
const { auth, tag } = vi.hoisted(() => ({ auth: vi.fn(), tag: vi.fn() }));
vi.mock("@/server/db", () => ({ getDatabase: () => database.db }));
vi.mock("@/server/auth", () => ({ auth, authenticationEnabled: () => true }));
vi.mock("next/cache", () => ({ revalidateTag: tag }));
import { bootstrapOwner } from "@/server/services/bootstrap";
import { createOperator, operatorDirectory } from "@/server/services/operators";
import { listAdminReviews } from "@/server/services/reviews";
import { listAudit } from "@/server/services/admin-audit";
import {
  listApprovedReviews,
  approvedReviewSummary,
} from "@/server/repositories/reviews";
import { loadPrincipal } from "@/server/auth/principal";
import { verifyPassword } from "@/server/auth/password";
import { POST as staffRoute } from "@/app/api/admin/operators/route";
import { POST as reviewRoute } from "@/app/api/admin/reviews/route";
let ownerId: string,
  orderId: string,
  limitedId: string,
  catalogRole: string,
  ownerRole: string,
  productId: string;
const login = (id: string) =>
  auth.mockResolvedValue({ user: { id, sessionVersion: 0 } });
const request = (body: unknown) =>
  new Request("http://localhost/api/admin/test", {
    method: "POST",
    headers: {
      host: "localhost",
      origin: "http://localhost",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
beforeAll(async () => {
  database = await startTestDatabase();
  ownerId = (
    await bootstrapOwner(database.db, {
      name: "TEST Owner",
      email: "ops-owner@test.invalid",
      password: "TEST secure owner password",
    })
  ).id;
  login(ownerId);
  const roles = await database.db.select().from(s.roles);
  catalogRole = roles.find((r) => r.name === "Catalog Operator")!.id;
  ownerRole = roles.find((r) => r.isOwner)!.id;
  orderId = (
    await createOperator({
      name: "TEST Order",
      email: "ops-order@test.invalid",
      password: "TEST secure order password",
      roleId: roles.find((r) => r.name === "Order Operator")!.id,
    })
  ).id;
  const [limitedRole] = await database.db
    .insert(s.roles)
    .values({ name: "TEST Restricted staff manager" })
    .returning();
  const perms = await database.db
    .select()
    .from(s.permissions)
    .where(
      inArray(s.permissions.key, [
        "admin.access",
        "operators.read",
        "operators.manage",
      ]),
    );
  await database.db
    .insert(s.rolePermissions)
    .values(
      perms.map((p) => ({ roleId: limitedRole!.id, permissionId: p.id })),
    );
  limitedId = (
    await createOperator({
      name: "TEST Limited",
      email: "ops-limited@test.invalid",
      password: "TEST secure limited password",
      roleId: limitedRole!.id,
    })
  ).id;
  const [category] = await database.db
    .insert(s.categories)
    .values({ name: "TEST Category", slug: randomUUID() })
    .returning();
  const [product] = await database.db
    .insert(s.products)
    .values({
      name: "TEST Review Product",
      sku: "TEST-REVIEW",
      slug: randomUUID(),
      categoryId: category!.id,
      description: "TEST",
      conditionNotes: "TEST",
      price: 40000,
      status: "active",
      quantity: 1,
    })
    .returning();
  productId = product!.id;
});
afterAll(async () => {
  await database?.stop();
});
beforeEach(() => {
  login(ownerId);
  tag.mockClear();
});
it("creates and manages staff without exposing credentials; resets passwords and revokes sessions", async () => {
  const input = {
    action: "create",
    name: "TEST Catalog Staff",
    email: "ops-new@test.invalid",
    password: "TEST newly assigned password",
    roleId: catalogRole,
  };
  const response = await staffRoute(request(input));
  expect(response.status).toBe(200);
  const created = await response.json();
  expect(created.status).toBe("active");
  expect(JSON.stringify(created)).not.toContain("password");
  expect((await staffRoute(request(input))).status).toBe(409);
  const found = await operatorDirectory({ q: "ops-new", pageSize: 1 });
  expect(found.total).toBe(1);
  expect(found.items[0]?.roleName).toBe("Catalog Operator");
  expect(
    (
      await staffRoute(
        request({
          action: "update",
          id: created.id,
          status: "inactive",
          updatedAt: created.updatedAt,
        }),
      )
    ).status,
  ).toBe(200);
  await expect(
    loadPrincipal(database.db, { id: created.id, sessionVersion: 0 }),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  expect(
    (
      await staffRoute(
        request({
          action: "update",
          id: created.id,
          status: "active",
          updatedAt: created.updatedAt,
        }),
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await staffRoute(
        request({ action: "update", id: created.id, status: "active" }),
      )
    ).status,
  ).toBe(200);
  const password = "TEST replacement secret password";
  expect(
    (await staffRoute(request({ action: "reset", id: created.id, password })))
      .status,
  ).toBe(200);
  const [user] = await database.db
    .select()
    .from(s.users)
    .where(eq(s.users.id, created.id));
  expect(await verifyPassword(password, user!.passwordHash!)).toBe(true);
  expect(user?.sessionVersion).toBe(3);
  const audit = await listAudit({ entity: "user", q: created.id });
  expect(audit.items.map((r) => r.action)).toContain("operator.password_reset");
  expect(JSON.stringify(audit)).not.toContain(password);
});
it("protects final Owner, forbids privilege escalation and rejects unauthorized direct requests", async () => {
  expect(
    (
      await staffRoute(
        request({ action: "update", id: ownerId, status: "inactive" }),
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await staffRoute(
        request({
          action: "create",
          name: "TEST",
          email: "bad",
          password: "short",
          roleId: catalogRole,
        }),
      )
    ).status,
  ).toBe(400);
  login(limitedId);
  expect(
    (
      await staffRoute(
        request({
          action: "create",
          name: "TEST Escalation",
          email: "escalate@test.invalid",
          password: "TEST escalation password",
          roleId: ownerRole,
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await staffRoute(
        request({ action: "update", id: limitedId, roleId: ownerRole }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await staffRoute(
        request({
          action: "reset",
          id: ownerId,
          password: "TEST unauthorized password",
        }),
      )
    ).status,
  ).toBe(403);
  login(orderId);
  expect(
    (
      await staffRoute(
        request({ action: "update", id: ownerId, status: "inactive" }),
      )
    ).status,
  ).toBe(403);
  await expect(listAudit()).rejects.toMatchObject({ code: "FORBIDDEN" });
  auth.mockResolvedValue(null);
  expect(
    (
      await staffRoute(
        request({
          action: "reset",
          id: ownerId,
          password: "TEST unauthorized password",
        }),
      )
    ).status,
  ).toBe(401);
});
it("moderates only authorized reviews, invalidates public reads and detects stale moderation", async () => {
  const [review] = await database.db
    .insert(s.reviews)
    .values({
      productId,
      reviewerName: "TEST Pending Buyer",
      rating: 4,
      body: "TEST pending review",
    })
    .returning();
  expect(await listApprovedReviews(productId)).toHaveLength(0);
  const queue = await listAdminReviews({ q: "TEST-REVIEW", status: "pending" });
  expect(queue.items[0]?.id).toBe(review!.id);
  login(orderId);
  expect(
    (await reviewRoute(request({ id: review!.id, status: "approved" }))).status,
  ).toBe(403);
  expect(tag).not.toHaveBeenCalled();
  login(ownerId);
  expect(
    (
      await reviewRoute(
        request({ id: review!.id, status: "approved", rating: 5 }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await reviewRoute(
        request({
          id: review!.id,
          status: "approved",
          updatedAt: review!.updatedAt.toISOString(),
        }),
      )
    ).status,
  ).toBe(200);
  expect(tag).toHaveBeenCalledWith("reviews", { expire: 0 });
  expect(await approvedReviewSummary(productId)).toEqual({
    count: 1,
    average: 4,
  });
  expect(
    (
      await reviewRoute(
        request({
          id: review!.id,
          status: "rejected",
          updatedAt: review!.updatedAt.toISOString(),
        }),
      )
    ).status,
  ).toBe(409);
  expect(
    (await reviewRoute(request({ id: review!.id, status: "rejected" }))).status,
  ).toBe(200);
  expect(await listApprovedReviews(productId)).toHaveLength(0);
  expect(
    (await listAdminReviews({ status: "rejected", q: "TEST Pending" })).total,
  ).toBe(1);
  const audit = await listAudit({ entity: "review", q: review!.id });
  expect(audit.total).toBe(2);
});
