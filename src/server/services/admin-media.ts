import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, lt, sql, or, isNull } from "drizzle-orm";
import { z } from "zod";
import { withStaff } from "@/server/auth/authorize";
import { assertPermission } from "@/server/auth/policy";
import {
  mediaUploads,
  mediaDeletions,
  productImages,
} from "@/server/db/schema";
import { getStorage } from "@/server/storage/r2";
import { uploadSchema } from "@/server/storage/policy";
import { optimizeProductImage } from "@/server/storage/optimize";
import { AppError } from "@/lib/errors";
import { lockEditableProduct } from "./admin-products";
import { writeAudit } from "./audit";
export async function authorizeProductUpload(input: unknown) {
  return withStaff("media.write", async (tx, actor) => {
    assertPermission(actor, "products.update");
    const data = z
      .object({
        productId: z.uuid(),
        mime: uploadSchema.shape.mime,
        bytes: uploadSchema.shape.bytes,
        altText: z.string().trim().min(1).max(300),
        isDefectImage: z.boolean(),
      })
      .strict()
      .parse(input);
    await lockEditableProduct(tx, data.productId);
    const existing = await tx
      .select({ id: productImages.id })
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, data.productId),
          or(
            isNull(productImages.groupId),
            eq(productImages.variant, "detail"),
          ),
        ),
      )
      .limit(40);
    const waiting = await tx
      .select({ id: mediaUploads.id })
      .from(mediaUploads)
      .where(
        and(
          eq(mediaUploads.productId, data.productId),
          eq(mediaUploads.ready, false),
        ),
      )
      .limit(10);
    if (existing.length >= 40 || waiting.length >= 10)
      throw new AppError("VALIDATION_ERROR", {
        file: [
          "Batas 40 foto atau 10 unggahan tertunda tercapai. Hapus foto atau bersihkan unggahan kedaluwarsa.",
        ],
      });
    const signed = await getStorage().createUpload({
      purpose: "product-source",
      mime: data.mime,
      bytes: data.bytes,
    });
    const id = randomUUID();
    await tx.insert(mediaUploads).values({
      id,
      ...data,
      actorId: actor.id,
      sourceKey: signed.key,
      variantKeys: {
        thumbnail: `product/${randomUUID()}.webp`,
        card: `product/${randomUUID()}.webp`,
        detail: `product/${randomUUID()}.webp`,
      },
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    return {
      id,
      url: signed.url,
      headers: signed.headers,
      expiresIn: signed.expiresIn,
    };
  });
}
export async function completeProductUpload(input: unknown) {
  return withStaff("media.write", async (tx, actor) => {
    assertPermission(actor, "products.update");
    const data = z
      .object({ productId: z.uuid(), uploadId: z.uuid() })
      .strict()
      .parse(input);
    // The same product lock serializes completion, reorder and deletion. Upload plans were
    // committed before any object write, so partial R2 writes remain discoverable after rollback.
    const product = await lockEditableProduct(tx, data.productId);
    const [intent] = await tx
      .select()
      .from(mediaUploads)
      .where(
        and(
          eq(mediaUploads.id, data.uploadId),
          eq(mediaUploads.productId, data.productId),
          eq(mediaUploads.actorId, actor.id),
        ),
      )
      .for("update");
    if (!intent) throw new AppError("NOT_FOUND");
    if (intent.ready) return { slug: product.slug, ready: true };
    if (intent.expiresAt <= new Date())
      throw new AppError("VALIDATION_ERROR", {
        file: ["Otorisasi unggahan kedaluwarsa. Unggah ulang file."],
      });
    const storage = getStorage();
    const info = await storage.inspectObject(
      "product-source",
      intent.sourceKey,
    );
    if (info.bytes !== intent.bytes || info.mime !== intent.mime)
      throw new AppError("VALIDATION_ERROR");
    const body = await storage.readProductSource(
      intent.sourceKey,
      10 * 1024 * 1024,
    );
    if (body.length !== intent.bytes) throw new AppError("VALIDATION_ERROR");
    const variants = await optimizeProductImage(body, intent.mime);
    const existing = await tx
      .select({ order: productImages.sortOrder })
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, product.id),
          or(
            isNull(productImages.groupId),
            eq(productImages.variant, "detail"),
          ),
        ),
      )
      .orderBy(asc(productImages.sortOrder))
      .limit(40);
    if (existing.length >= 40) throw new AppError("VALIDATION_ERROR");
    const sortOrder = existing.length
      ? Math.max(...existing.map((i) => i.order)) + 1
      : 0;
    for (const image of variants) {
      const key = intent.variantKeys[image.variant];
      await storage.writeProductVariant(key, image.data);
      await tx.insert(productImages).values({
        productId: product.id,
        groupId: intent.id,
        objectKey: key,
        altText: intent.altText,
        width: image.width,
        height: image.height,
        bytes: image.bytes,
        mimeType: "image/webp",
        variant: image.variant,
        sortOrder,
        isDefectImage: intent.isDefectImage,
      });
    }
    await tx
      .update(mediaUploads)
      .set({ ready: true })
      .where(eq(mediaUploads.id, intent.id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "media.attached",
      entityType: "product",
      entityId: product.id,
    });
    return { slug: product.slug, ready: true };
  });
}
export async function changeProductMedia(input: unknown) {
  return withStaff("media.write", async (tx, actor) => {
    assertPermission(actor, "products.update");
    const data = z
      .discriminatedUnion("action", [
        z
          .object({
            action: z.literal("reorder"),
            productId: z.uuid(),
            ids: z.array(z.uuid()).max(40),
          })
          .strict(),
        z
          .object({
            action: z.literal("edit"),
            productId: z.uuid(),
            imageId: z.uuid(),
            altText: z.string().trim().min(1).max(300),
            isDefectImage: z.boolean(),
          })
          .strict(),
        z
          .object({
            action: z.literal("remove"),
            productId: z.uuid(),
            imageId: z.uuid(),
          })
          .strict(),
      ])
      .parse(input);
    const product = await lockEditableProduct(tx, data.productId);
    const rows = await tx
      .select()
      .from(productImages)
      .where(eq(productImages.productId, product.id))
      .orderBy(asc(productImages.sortOrder), asc(productImages.id))
      .limit(120);
    const representatives = rows.filter(
      (i) => !i.groupId || i.variant === "detail",
    );
    if (data.action === "reorder") {
      if (
        data.ids.length !== representatives.length ||
        new Set(data.ids).size !== data.ids.length ||
        data.ids.some((id) => !representatives.some((i) => i.id === id))
      )
        throw new AppError("CONFLICT");
      for (const [sortOrder, id] of data.ids.entries()) {
        const image = representatives.find((i) => i.id === id)!;
        await tx
          .update(productImages)
          .set({ sortOrder })
          .where(
            image.groupId
              ? eq(productImages.groupId, image.groupId)
              : eq(productImages.id, image.id),
          );
      }
    } else {
      const image = representatives.find((i) => i.id === data.imageId);
      if (!image) throw new AppError("NOT_FOUND");
      const where = image.groupId
        ? eq(productImages.groupId, image.groupId)
        : eq(productImages.id, image.id);
      if (
        data.action === "edit" &&
        data.isDefectImage &&
        product.status === "active" &&
        !representatives.some((i) => i.id !== image.id && !i.isDefectImage)
      )
        throw new AppError("VALIDATION_ERROR", {
          file: ["Simpan minimal satu foto utama tanpa penanda cacat."],
        });
      if (data.action === "edit")
        await tx
          .update(productImages)
          .set({ altText: data.altText, isDefectImage: data.isDefectImage })
          .where(where);
      else {
        if (
          product.status === "active" &&
          !representatives.some((i) => i.id !== image.id && !i.isDefectImage)
        )
          throw new AppError("VALIDATION_ERROR", {
            file: [
              "Produk aktif memerlukan foto utama. Tambahkan pengganti atau ubah produk menjadi draft dahulu.",
            ],
          });
        const targets = rows.filter((i) =>
          image.groupId ? i.groupId === image.groupId : i.id === image.id,
        );
        for (const target of targets)
          await tx
            .insert(mediaDeletions)
            .values({ productId: product.id, objectKey: target.objectKey })
            .onConflictDoNothing();
        await tx.delete(productImages).where(where);
      }
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: data.action === "remove" ? "media.removed" : "media.updated",
      entityType: "product",
      entityId: product.id,
    });
    return { slug: product.slug };
  });
}
export async function cleanupProductMedia(productId: string) {
  return withStaff("media.write", async (tx) => {
    z.uuid().parse(productId);
    const storage = getStorage();
    let failed = 0;
    let cleaned = 0;
    const jobs = await tx
      .select()
      .from(mediaDeletions)
      .where(eq(mediaDeletions.productId, productId))
      .limit(120)
      .for("update", { skipLocked: true });
    for (const job of jobs) {
      try {
        await storage.deleteObject("product", job.objectKey);
        await tx.delete(mediaDeletions).where(eq(mediaDeletions.id, job.id));
        cleaned++;
      } catch {
        failed++;
        await tx
          .update(mediaDeletions)
          .set({ attempts: sql`${mediaDeletions.attempts} + 1` })
          .where(eq(mediaDeletions.id, job.id));
      }
    }
    const uploads = await tx
      .select()
      .from(mediaUploads)
      .where(
        and(
          eq(mediaUploads.productId, productId),
          lt(mediaUploads.expiresAt, new Date()),
        ),
      )
      .limit(10)
      .for("update", { skipLocked: true });
    for (const upload of uploads) {
      try {
        await storage.deleteObject("product-source", upload.sourceKey);
        if (!upload.ready)
          for (const key of Object.values(upload.variantKeys))
            await storage.deleteObject("product", key);
        await tx.delete(mediaUploads).where(eq(mediaUploads.id, upload.id));
        cleaned++;
      } catch {
        failed++;
      }
    }
    return { failed, cleaned };
  });
}
