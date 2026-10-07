import { expect, it, vi } from "vitest";
import { adminResponse } from "@/server/http/admin";
it("checks browser origin against host rather than Next internal URL", async () => {
  const operation = vi.fn(async () => ({ ok: true }));
  for (const origin of ["https://attacker.invalid", "null", ""]) {
    const result = await adminResponse(
      new Request("http://localhost/api/admin/products", {
        method: "POST",
        headers: {
          host: "shop.example.invalid",
          "x-forwarded-proto": "https",
          origin,
          "content-type": "application/json",
        },
        body: "{}",
      }),
      operation,
    );
    expect(result.status).toBe(403);
  }
  expect(operation).not.toHaveBeenCalled();
  const result = await adminResponse(
    new Request("http://localhost/api/admin/products", {
      method: "POST",
      headers: {
        host: "shop.example.invalid",
        "x-forwarded-proto": "https",
        origin: "https://shop.example.invalid",
        "content-type": "application/json",
      },
      body: "{}",
    }),
    operation,
  );
  expect(result.status).toBe(200);
  expect(operation).toHaveBeenCalledOnce();
});
