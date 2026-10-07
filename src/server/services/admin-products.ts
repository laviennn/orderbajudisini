import "server-only";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { withStaff } from "@/server/auth/authorize";
import { assertPermission } from "@/server/auth/policy";
import {
  products,
  categories,
  productMeasurements,
  productImages,
  reservations,
} from "@/server/db/schema";
import type { Transaction } from "@/server/db/operations";
import {
  productEditorInput,
  categoryEditorInput,
} from "@/features/admin/validation";
import { AppError } from "@/lib/errors";
import { writeAudit } from "./audit";
import { primaryImage, publicImage } from "@/server/repositories/catalog";
export async function lockEditableProduct(tx: Transaction, id: string) {
  z.uuid().parse(id);
  const [p] = await tx
    .select()
    .from(products)
    .where(eq(products.id, id))
    .for("update");
  if (!p) throw new AppError("NOT_FOUND");
  const held = await tx
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      and(eq(reservations.productId, id), eq(reservations.status, "reserved")),
    )
    .limit(1);
  if (p.status === "sold" || p.status === "reserved" || held.length)
    throw new AppError("CONFLICT", {
      status: [
        "Produk terjual/dipesan tidak dapat diubah melalui editor katalog.",
      ],
    });
  return p;
}
export function checkRevision(current: Date, submitted?: string) {
  if (!submitted || current.getTime() !== new Date(submitted).getTime())
    throw new AppError("CONFLICT");
}
const revision = (old: Date) =>
  new Date(Math.max(Date.now(), old.getTime() + 1));
export async function saveProduct(input: unknown) {
  const isUpdate =
    typeof input === "object" &&
    input !== null &&
    "id" in input &&
    typeof input.id === "string";
  return withStaff(
    isUpdate ? "products.update" : "products.create",
    async (tx, actor) => {
      const data = productEditorInput.parse(input);
      const { id, updatedAt, confirmSlugChange, measurements, ...values } =
        data;
      // Use the same lock ordering as pricing/checkout before taking product rows.
      await tx.execute(sql`select pg_advisory_xact_lock(73102)`);
      const old = id ? await lockEditableProduct(tx, id) : null;
      if (old) checkRevision(old.updatedAt, updatedAt);
      const [category] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, data.categoryId))
        .for("share");
      if (!category || (old?.status === "active" && !category.active))
        throw new AppError("VALIDATION_ERROR", {
          categoryId: [
            "Pilih kategori aktif untuk produk yang dipublikasikan.",
          ],
        });
      if (
        (!old && data.promotionEligible) ||
        (old && old.promotionEligible !== data.promotionEligible)
      )
        assertPermission(actor, "promotions.manage");
      if (old?.publishedAt && old.slug !== data.slug && !confirmSlugChange)
        throw new AppError("VALIDATION_ERROR", {
          slug: ["Konfirmasi perubahan URL produk yang pernah dipublikasikan."],
        });
      const duplicates = await tx
        .select({ sku: products.sku, slug: products.slug })
        .from(products)
        .where(
          and(
            old ? ne(products.id, old.id) : undefined,
            or(eq(products.sku, data.sku), eq(products.slug, data.slug)),
          ),
        )
        .limit(2);
      if (duplicates.length)
        throw new AppError(
          "VALIDATION_ERROR",
          Object.fromEntries([
            ...(duplicates.some((p) => p.sku === data.sku)
              ? [["sku", ["SKU sudah digunakan."]]]
              : []),
            ...(duplicates.some((p) => p.slug === data.slug)
              ? [["slug", ["Slug sudah digunakan."]]]
              : []),
          ]),
        );
      if (old?.status === "active" && values.quantity < 1)
        throw new AppError("VALIDATION_ERROR", {
          quantity: [
            "Produk aktif harus memiliki stok. Simpan sebagai draft untuk menonaktifkan.",
          ],
        });
      const [p] = old
        ? await tx
            .update(products)
            .set({
              ...values,
              updatedBy: actor.id,
              updatedAt: revision(old.updatedAt),
            })
            .where(eq(products.id, old.id))
            .returning()
        : await tx
            .insert(products)
            .values({
              ...values,
              status: "draft",
              createdBy: actor.id,
              updatedBy: actor.id,
            })
            .returning();
      if (!p) throw new AppError("INTERNAL_ERROR");
      await tx
        .delete(productMeasurements)
        .where(eq(productMeasurements.productId, p.id));
      if (measurements.length)
        await tx.insert(productMeasurements).values(
          measurements.map((m, sortOrder) => ({
            ...m,
            value: m.value.toFixed(2),
            productId: p.id,
            sortOrder,
          })),
        );
      await writeAudit(tx, {
        actorId: actor.id,
        action: old ? "product.updated" : "product.created",
        entityType: "product",
        entityId: p.id,
        metadata: { changedFields: Object.keys(values) },
      });
      if (old?.promotionEligible !== p.promotionEligible)
        await writeAudit(tx, {
          actorId: actor.id,
          action: "product.eligibility_changed",
          entityType: "product",
          entityId: p.id,
          metadata: { changedFields: ["promotionEligible"] },
        });
      if (
        old?.seoTitle !== p.seoTitle ||
        old?.seoDescription !== p.seoDescription
      )
        await writeAudit(tx, {
          actorId: actor.id,
          action: "seo.updated",
          entityType: "product",
          entityId: p.id,
          metadata: { changedFields: ["seoTitle", "seoDescription"] },
        });
      return {
        id: p.id,
        slug: p.slug,
        previousSlug: old?.slug,
        updatedAt: p.updatedAt,
      };
    },
  );
}
export async function changeProductStatus(input: unknown) {
  const data = z
    .object({
      id: z.uuid(),
      updatedAt: z.iso.datetime(),
      action: z.enum(["publish", "draft", "archive"]),
    })
    .strict()
    .parse(input);
  return withStaff(
    data.action === "archive" ? "products.archive" : "products.publish",
    async (tx, actor) => {
      await tx.execute(sql`select pg_advisory_xact_lock_shared(73102)`);
      const p = await lockEditableProduct(tx, data.id);
      checkRevision(p.updatedAt, data.updatedAt);
      const next =
        data.action === "publish"
          ? "active"
          : data.action === "archive"
            ? "archived"
            : "draft";
      if (next === "active") {
        const [c] = await tx
          .select()
          .from(categories)
          .where(eq(categories.id, p.categoryId))
          .for("share");
        const images = await tx
          .select({ id: productImages.id })
          .from(productImages)
          .where(
            and(
              eq(productImages.productId, p.id),
              eq(productImages.isDefectImage, false),
            ),
          )
          .limit(1);
        if (
          !c?.active ||
          p.quantity < 1 ||
          !p.description.trim() ||
          !p.conditionNotes.trim() ||
          !images.length
        )
          throw new AppError("VALIDATION_ERROR", {
            publish: [
              "Lengkapi kategori aktif, stok, deskripsi, kondisi, dan minimal satu foto produk sebelum publikasi.",
            ],
          });
      }
      await tx
        .update(products)
        .set({
          status: next,
          updatedAt: revision(p.updatedAt),
          updatedBy: actor.id,
          ...(next === "active" && !p.publishedAt
            ? { publishedAt: new Date() }
            : {}),
        })
        .where(eq(products.id, p.id));
      await writeAudit(tx, {
        actorId: actor.id,
        action:
          next === "active"
            ? "product.published"
            : next === "archived"
              ? "product.archived"
              : "product.unpublished",
        entityType: "product",
        entityId: p.id,
        metadata: { from: p.status, to: next },
      });
      return { id: p.id, slug: p.slug };
    },
  );
}
export async function adminProduct(id: string) {
  return withStaff("products.read", async (tx) => {
    z.uuid().parse(id);
    const [p] = await tx
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!p) throw new AppError("NOT_FOUND");
    const [measurements, images] = await Promise.all([
      tx
        .select()
        .from(productMeasurements)
        .where(eq(productMeasurements.productId, id))
        .orderBy(asc(productMeasurements.sortOrder))
        .limit(30),
      tx
        .select()
        .from(productImages)
        .where(eq(productImages.productId, id))
        .orderBy(asc(productImages.sortOrder), asc(productImages.id))
        .limit(120),
    ]);
    return {
      ...p,
      updatedAt: p.updatedAt.toISOString(),
      publishedAt: p.publishedAt?.toISOString() ?? null,
      measurements: measurements.map((m) => ({
        key: m.key,
        label: m.label,
        value: Number(m.value),
        unit: m.unit,
      })),
      images: images
        .filter((i) => !i.groupId || i.variant === "detail")
        .map((i) => ({
          id: i.id,
          groupId: i.groupId,
          altText: i.altText,
          isDefectImage: i.isDefectImage,
          image: publicImage(i),
        })),
    };
  });
}
export async function adminProductList(input: unknown) {
  return withStaff("products.read", async (tx) => {
    const f = z
      .object({
        q: z.string().max(80).default(""),
        category: z.string().default(""),
        status: z
          .enum(["", "draft", "active", "reserved", "sold", "archived"])
          .catch("")
          .default(""),
        eligible: z.enum(["", "yes", "no"]).catch("").default(""),
        page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
      })
      .parse(input);
    const q = `%${f.q.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = await tx
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        slug: products.slug,
        status: products.status,
        category: categories.name,
        sizeLabel: products.sizeLabel,
        price: products.price,
        updatedAt: products.updatedAt,
        image: primaryImage,
      })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(
        and(
          f.q ? or(ilike(products.name, q), ilike(products.sku, q)) : undefined,
          f.category && z.uuid().safeParse(f.category).success
            ? eq(products.categoryId, f.category)
            : undefined,
          f.status ? eq(products.status, f.status) : undefined,
          f.eligible
            ? eq(products.promotionEligible, f.eligible === "yes")
            : undefined,
        ),
      )
      .orderBy(desc(products.updatedAt), asc(products.id))
      .limit(25)
      .offset((f.page - 1) * 24);
    return {
      items: rows
        .slice(0, 24)
        .map((p) => ({ ...p, image: publicImage(p.image) })),
      hasNext: rows.length > 24,
      page: f.page,
    };
  });
}
export async function adminCategories() {
  return withStaff("categories.read", (tx) =>
    tx
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name))
      .limit(500),
  );
}
export async function saveCategory(input: unknown) {
  return withStaff("categories.write", async (tx, actor) => {
    const data = categoryEditorInput.parse(input);
    const { id, updatedAt, confirmSlugChange, ...values } = data;
    const old = id
      ? (
          await tx
            .select()
            .from(categories)
            .where(eq(categories.id, id))
            .for("update")
        )[0]
      : null;
    if (id && !old) throw new AppError("NOT_FOUND");
    if (old) {
      checkRevision(old.updatedAt, updatedAt);
      if (old.slug !== data.slug && !confirmSlugChange)
        throw new AppError("VALIDATION_ERROR", {
          slug: ["Konfirmasi perubahan URL kategori."],
        });
    }
    const duplicate = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.slug, data.slug),
          old ? ne(categories.id, old.id) : undefined,
        ),
      )
      .limit(1);
    if (duplicate.length)
      throw new AppError("VALIDATION_ERROR", {
        slug: ["Slug kategori sudah digunakan."],
      });
    const [row] = old
      ? await tx
          .update(categories)
          .set({ ...values, updatedAt: revision(old.updatedAt) })
          .where(eq(categories.id, old.id))
          .returning()
      : await tx.insert(categories).values(values).returning();
    if (!row) throw new AppError("INTERNAL_ERROR");
    await writeAudit(tx, {
      actorId: actor.id,
      action: "category.updated",
      entityType: "category",
      entityId: row.id,
      metadata: { changedFields: Object.keys(values) },
    });
    return { id: row.id, slug: row.slug, previousSlug: old?.slug };
  });
}
export async function catalogDashboard() {
  return withStaff("products.read", (tx) =>
    tx
      .select({
        status: products.status,
        count: sql<number>`count(*)::integer`,
      })
      .from(products)
      .groupBy(products.status),
  );
}
