import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  cached: vi.fn<
    (
      fn: unknown,
      keys: string[],
      options: { revalidate: number; tags: string[] },
    ) => () => Promise<null>
  >(() => vi.fn().mockResolvedValue(null)),
  tag: vi.fn(),
  save: vi.fn(),
  status: vi.fn(),
  category: vi.fn(),
  media: vi.fn(),
  complete: vi.fn(),
  cleanup: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_cache: mocks.cached,
  revalidateTag: mocks.tag,
}));
vi.mock("@/server/services/admin-products", () => ({
  saveProduct: mocks.save,
  changeProductStatus: mocks.status,
  saveCategory: mocks.category,
}));
vi.mock("@/server/services/admin-media", () => ({
  changeProductMedia: mocks.media,
  completeProductUpload: mocks.complete,
  cleanupProductMedia: mocks.cleanup,
}));
import { readProduct } from "@/server/services/storefront";
import {
  invalidateProduct,
  invalidateCategories,
} from "@/server/services/catalog-cache";
import { POST as save } from "@/app/api/admin/products/route";
import { POST as status } from "@/app/api/admin/products/[id]/status/route";
import { POST as category } from "@/app/api/admin/categories/route";
import { POST as media } from "@/app/api/admin/products/[id]/media/route";
import { POST as complete } from "@/app/api/admin/products/[id]/media/complete/route";

// Vitest clears mock call history before each test; retain module-level registrations.
const registrations = mocks.cached.mock.calls.slice();

beforeEach(() => {
  mocks.tag.mockReset();
  for (const fn of [
    mocks.save,
    mocks.status,
    mocks.category,
    mocks.media,
    mocks.complete,
    mocks.cleanup,
  ])
    fn.mockReset();
});

function tagsFor(key: string) {
  const registration = [...registrations, ...mocks.cached.mock.calls].find(
    ([, keys]) => keys[0] === key,
  );
  expect(registration, `cache registration: ${key}`).toBeDefined();
  expect(registration![2].revalidate).toBe(60);
  return registration![2].tags;
}
function isInvalidated(tags: string[]) {
  return mocks.tag.mock.calls.some(
    ([tag, profile]) => tags.includes(tag) && profile.expire === 0,
  );
}

it("expires catalog, facets, related products and both product slugs without flushing unrelated storefront data", async () => {
  await readProduct("test-old");
  await readProduct("test-new");
  invalidateProduct("test-new", "test-old");
  for (const key of ["catalog-v2", "facets-v2", "related-v2"]) {
    expect(isInvalidated(tagsFor(key))).toBe(true);
  }
  const productReads = mocks.cached.mock.calls.filter(
    ([, keys]) => keys[0] === "product-v2",
  );
  expect(productReads).toHaveLength(2);
  for (const [, keys, options] of productReads) {
    expect(isInvalidated(options.tags), keys[1]).toBe(true);
    expect(options.revalidate).toBe(60);
  }
  expect(mocks.tag).toHaveBeenCalledWith("sitemap", { expire: 0 });
  for (const key of [
    "categories-v2",
    "category-v2",
    "public-store-v1",
    "banner-v1",
    "reviews-v1",
  ]) {
    expect(isInvalidated(tagsFor(key)), key).toBe(false);
  }
});

it("category edits invalidate category reads and all product/category-dependent caches", async () => {
  await readProduct("test-new");
  invalidateCategories();
  for (const key of [
    "catalog-v2",
    "facets-v2",
    "related-v2",
    "categories-v2",
    "category-v2",
    "product-v2",
  ]) {
    expect(isInvalidated(tagsFor(key)), key).toBe(true);
  }
  expect(mocks.tag).toHaveBeenCalledWith("sitemap", { expire: 0 });
  expect(isInvalidated(tagsFor("public-store-v1"))).toBe(false);
});

const context = {
  params: Promise.resolve({ id: "10000000-0000-4000-8000-000000000032" }),
};
const routes = [
  { name: "product save/rename", run: save, mutation: mocks.save, body: {} },
  ...["publish", "draft", "archive"].map((action) => ({
    name: action,
    run: status,
    mutation: mocks.status,
    body: { action, updatedAt: "2026-01-01T00:00:00.000Z" },
  })),
  { name: "category save", run: category, mutation: mocks.category, body: {} },
  {
    name: "media completion",
    run: complete,
    mutation: mocks.complete,
    body: { uploadId: "20000000-0000-4000-8000-000000000001" },
  },
  {
    name: "media edit/reorder",
    run: media,
    mutation: mocks.media,
    body: { action: "reorder" },
  },
  {
    name: "media detachment",
    run: media,
    mutation: mocks.media,
    body: { action: "remove" },
  },
];
function request(body: unknown) {
  return new Request("http://localhost/api/admin/test", {
    method: "POST",
    headers: {
      host: "localhost",
      origin: "http://localhost",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
it.each(routes)(
  "$name invalidates only after the mutation commits",
  async ({ run, mutation, body }) => {
    let committed = false;
    mutation.mockImplementation(async () => {
      expect(mocks.tag).not.toHaveBeenCalled();
      committed = true;
      return { slug: "test-new", previousSlug: "test-old" };
    });
    mocks.tag.mockImplementation(() => expect(committed).toBe(true));
    const response = await run(request(body), context);
    expect(response.status).toBe(200);
    expect(mutation).toHaveBeenCalledOnce();
    expect(mocks.tag).toHaveBeenCalledWith("catalog", { expire: 0 });
    expect(mocks.tag).toHaveBeenCalledWith("sitemap", { expire: 0 });
  },
);
it.each(routes)(
  "$name leaves caches intact on a failed mutation",
  async ({ run, mutation, body }) => {
    mutation.mockRejectedValue(new AppError("FORBIDDEN"));
    const response = await run(request(body), context);
    expect(response.status).toBe(403);
    expect(mocks.tag).not.toHaveBeenCalled();
  },
);
