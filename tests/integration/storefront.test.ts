import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { startTestDatabase } from "./database";
import { categories, products, promotions } from "@/server/db/schema";
import { parseCatalog } from "@/lib/catalog";
let database: Awaited<ReturnType<typeof startTestDatabase>>;
vi.mock("@/server/db", () => ({ getDatabase: () => database.db }));
const { listCatalog, getProduct, relatedProducts, getCategory, catalogFacets } =
  await import("@/server/repositories/catalog");
const { validateCart } = await import("@/server/services/cart");
let category: string;
let ids: string[];
beforeAll(async () => {
  database = await startTestDatabase();
  const [c] = await database.db
    .insert(categories)
    .values({ name: "TEST Shirts", slug: "test-shirts" })
    .returning();
  category = c!.id;
  const result = await database.db
    .insert(products)
    .values(
      Array.from({ length: 14 }, (_, i) => ({
        sku: `TEST-${i}`,
        slug: `test-product-${i}`,
        name: `TEST Product ${i}`,
        description: "TEST fixture",
        conditionNotes: "TEST notes",
        conditionGrade: "TEST good",
        categoryId: category,
        sizeLabel: "L",
        brand: i === 0 ? "TEST Brand" : null,
        price: 45000 + i * 1000,
        status:
          i === 10
            ? ("sold" as const)
            : i === 11
              ? ("draft" as const)
              : i === 12
                ? ("archived" as const)
                : i === 13
                  ? ("reserved" as const)
                  : ("active" as const),
        quantity: i === 10 || i === 13 ? 0 : 1,
        promotionEligible: i < 9,
      })),
    )
    .returning();
  ids = result.map((p) => p.id);
  await database.db.insert(promotions).values({
    name: "TEST Bundle",
    requiredQuantity: 3,
    bundlePrice: 100000,
    active: true,
    allocationStrategy: "highest_price_first",
    pricePolicy: "discount_only",
  });
});
afterAll(async () => database?.stop());
it("publishes only active catalog by default and excludes private states", async () => {
  const result = await listCatalog(parseCatalog({}));
  expect(result.items).toHaveLength(10);
  expect(result.items.every((p) => p.status === "active")).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(
    /promotionEligible|createdBy|objectKey|passwordHash/,
  );
  expect(await getProduct("test-product-11")).toBeNull();
  expect(await getProduct("test-product-12")).toBeNull();
  expect((await getProduct("test-product-10"))?.status).toBe("sold");
  expect(await getProduct("does-not-exist")).toBeNull();
  expect(await getCategory("absent")).toBeNull();
});
it("filters, literal search, sorting and bounded related queries work in SQL", async () => {
  expect(
    (
      await listCatalog(
        parseCatalog({ category: "test-shirts", q: "TEST Brand" }),
      )
    ).items.map((p) => p.id),
  ).toEqual([ids[0]]);
  expect((await listCatalog(parseCatalog({ q: "%" }))).items).toHaveLength(0);
  expect((await listCatalog(parseCatalog({ size: "S" }))).items).toHaveLength(
    0,
  );
  expect(
    (await listCatalog(parseCatalog({ min: "50000", max: "52000" }))).items,
  ).toHaveLength(3);
  expect(
    (await listCatalog(parseCatalog({ sort: "price-asc" }))).items[0]?.id,
  ).toBe(ids[0]);
  expect(
    (await listCatalog(parseCatalog({ sort: "price-desc" }))).items[0]?.id,
  ).toBe(ids[9]);
  const related = await relatedProducts(ids[0]!, category);
  expect(related).toHaveLength(4);
  expect(related.every((p) => p.id !== ids[0] && p.status === "active")).toBe(
    true,
  );
  expect((await catalogFacets()).sizes).toEqual(["L"]);
});
it("cart preserves insertion order but reads current DB prices and existing bundle strategy", async () => {
  const order = [ids[3]!, ids[9]!, ids[0]!, ids[1]!];
  const cart = await validateCart({ ids: order });
  expect(cart.items.map((p) => p.id)).toEqual(order);
  expect(cart.pricing?.merchandiseTotal).toBe(154000);
  expect(cart.pricing?.bundles[0]?.count).toBe(1);
  expect(JSON.stringify(cart)).not.toMatch(
    /promotionEligible|allocationStrategy|categoryId/,
  );
  await expect(validateCart({ ids: order, price: 1 })).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
});
it("unavailable and private cart entries stay visible without leaking draft information or counting totals", async () => {
  const cart = await validateCart({
    ids: [ids[0], ids[10], ids[11], ids[12], ids[13]],
  });
  expect(cart.items).toHaveLength(5);
  expect(cart.items.filter((p) => !p.available)).toHaveLength(4);
  expect(cart.items[2]?.name).toBe("Produk tidak tersedia");
  expect(cart.pricing?.merchandiseTotal).toBe(45000);
  expect(await validateCart({ ids: [] })).toEqual({ items: [], pricing: null });
});
