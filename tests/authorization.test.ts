import { describe, expect, it, vi } from "vitest";
import { assertPermission, type Principal } from "@/server/auth/policy";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getDatabase: vi.fn(),
  enabled: true,
}));
vi.mock("@/server/auth", () => ({
  auth: mocks.auth,
  authenticationEnabled: () => mocks.enabled,
}));
vi.mock("@/server/db", () => ({ getDatabase: mocks.getDatabase }));
import { requirePermission } from "@/server/auth/authorize";

describe("permission policy", () => {
  it("denies absent, deactivated and underprivileged principals", () => {
    const principals: (Principal | null)[] = [
      null,
      { id: "staff", status: "inactive", permissions: ["payments.verify"] },
      { id: "staff", status: "active", permissions: ["products.write"] },
    ];
    for (const principal of principals)
      expect(() => assertPermission(principal, "payments.verify")).toThrow();
  });
  it("requires the explicit permission even for operator management", () => {
    expect(() =>
      assertPermission(
        { id: "staff", status: "active", permissions: ["payments.verify"] },
        "operators.manage",
      ),
    ).toThrow();
    expect(() =>
      assertPermission(
        { id: "staff", status: "active", permissions: ["payments.verify"] },
        "payments.verify",
      ),
    ).not.toThrow();
  });
  it("checks current database grants and revocation rather than trusting session roles", async () => {
    const id = "cb76a25f-3a36-4cd8-9452-9a583593376d";
    mocks.auth.mockResolvedValue({
      user: { id, role: "owner", sessionVersion: 0 },
    });
    const where = vi.fn().mockResolvedValue([
      {
        id,
        status: "active",
        sessionVersion: 0,
        permission: "payments.verify",
      },
    ]);
    const query = { from: vi.fn(), leftJoin: vi.fn(), where };
    query.from.mockReturnValue(query);
    query.leftJoin.mockReturnValue(query);
    mocks.getDatabase.mockReturnValue({ select: () => query });
    expect((await requirePermission("payments.verify")).id).toBe(id);
    where.mockResolvedValue([
      {
        id,
        status: "inactive",
        sessionVersion: 0,
        permission: "payments.verify",
      },
    ]);
    await expect(requirePermission("payments.verify")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    where.mockResolvedValue([]);
    await expect(requirePermission("payments.verify")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
  it("fails closed when identity setup is disabled", async () => {
    mocks.enabled = false;
    await expect(requirePermission("admin.access")).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
    mocks.enabled = true;
  });
});
