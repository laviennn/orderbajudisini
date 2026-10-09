import "server-only";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { withStaff } from "@/server/auth/authorize";
import { banners } from "@/server/db/schema";
import { AppError } from "@/lib/errors";
import { writeAudit } from "./audit";
import { getStorage } from "@/server/storage/r2";
import { validateSiteImage } from "./site-media";
const text = z.string().trim().max(2000).nullable();
export const bannerInput = z
  .object({
    id: z.uuid().optional(),
    internalName: z.string().trim().min(1).max(200),
    headline: text,
    body: text,
    imageObjectKey: text,
    mobileImageObjectKey: text,
    ctaLabel: z.string().trim().max(120).nullable(),
    ctaUrl: z
      .string()
      .regex(/^\/(?!\/)[a-z0-9/?=&%#._-]*$/i)
      .nullable(),
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(10000),
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
  })
  .strict()
  .refine(
    (v) =>
      !v.startsAt ||
      !v.endsAt ||
      new Date(v.startsAt).getTime() < new Date(v.endsAt).getTime(),
    {
      message: "Akhir jadwal harus setelah awal.",
    },
  )
  .refine((v) => Boolean(v.ctaLabel) === Boolean(v.ctaUrl), {
    message: "Isi label dan tujuan tautan bersama.",
  })
  .refine((v) => !v.active || Boolean(v.headline || v.imageObjectKey), {
    message: "Banner aktif memerlukan judul atau gambar.",
  });
export async function listBanners() {
  return withStaff("content.read", async (tx) => {
    const rows = await tx
      .select()
      .from(banners)
      .orderBy(asc(banners.sortOrder), asc(banners.id))
      .limit(200);
    return rows.map(({ createdAt: _created, updatedAt: _updated, ...row }) => {
      void _created;
      void _updated;
      return {
        ...row,
        startsAt: row.startsAt?.toISOString() ?? null,
        endsAt: row.endsAt?.toISOString() ?? null,
        imageUrl: row.imageObjectKey
          ? getStorage().publicMediaUrl(row.imageObjectKey)
          : null,
        mobileUrl: row.mobileImageObjectKey
          ? getStorage().publicMediaUrl(row.mobileImageObjectKey)
          : null,
      };
    });
  });
}
export async function saveBanner(input: unknown) {
  return withStaff("content.write", async (tx, actor) => {
    const { id, ...data } = bannerInput.parse(input);
    for (const key of [data.imageObjectKey, data.mobileImageObjectKey])
      if (key) await validateSiteImage(key);
    const values = {
      ...data,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      updatedAt: new Date(),
    };
    const [saved] = id
      ? await tx
          .update(banners)
          .set(values)
          .where(eq(banners.id, id))
          .returning({ id: banners.id })
      : await tx.insert(banners).values(values).returning({ id: banners.id });
    if (!saved) throw new AppError("NOT_FOUND");
    await writeAudit(tx, {
      actorId: actor.id,
      action: "banner.updated",
      entityType: "banner",
      entityId: saved.id,
      metadata: { changedFields: Object.keys(data) },
    });
    return saved;
  });
}
export async function deleteBanner(input: unknown) {
  return withStaff("content.write", async (tx, actor) => {
    const { id } = z.object({ id: z.uuid() }).strict().parse(input);
    const [row] = await tx
      .delete(banners)
      .where(eq(banners.id, id))
      .returning({ id: banners.id });
    if (!row) throw new AppError("NOT_FOUND");
    await writeAudit(tx, {
      actorId: actor.id,
      action: "banner.deleted",
      entityType: "banner",
      entityId: id,
    });
    return row;
  });
}
