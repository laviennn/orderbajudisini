import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  remove: vi.fn(),
  cleanup: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("@/server/services/admin-media", () => ({
  changeProductMedia: mocks.remove,
  cleanupProductMedia: mocks.cleanup,
}));
vi.mock("@/server/services/catalog-cache", () => ({
  invalidateProduct: mocks.invalidate,
}));
import { POST } from "@/app/api/admin/products/[id]/media/route";
it("reports committed detachment with pending cleanup when cleanup cannot start", async () => {
  mocks.remove.mockResolvedValue({ slug: "test-product" });
  mocks.cleanup.mockRejectedValue(
    new Error("TEST provider configuration unavailable"),
  );
  const result = await POST(
    new Request("http://localhost/api/admin/products/test/media", {
      method: "POST",
      headers: {
        host: "localhost",
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "remove", imageId: "test-image" }),
    }),
    { params: Promise.resolve({ id: "test" }) },
  );
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({
    slug: "test-product",
    cleanup: { failed: 1, cleaned: 0 },
  });
  expect(mocks.invalidate).toHaveBeenCalledWith("test-product");
});
