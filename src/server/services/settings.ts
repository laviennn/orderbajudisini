import "server-only";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getDatabase } from "@/server/db";
import { databaseOperation } from "@/server/db/operations";
import { withStaff } from "@/server/auth/authorize";
import {
  bankAccounts,
  payments,
  seoSettings,
  storeSettings,
  qrisSettings,
} from "@/server/db/schema";
import { destinationSchema } from "@/server/shipping/contract";
import { assertObjectKey } from "@/server/storage/policy";
import { socialInput } from "@/lib/social-settings";
import { validateSiteImage } from "./site-media";
import { writeAudit } from "./audit";
import { seoInput } from "@/lib/seo-settings";
export { seoInput } from "@/lib/seo-settings";
export async function getPublicSeoSettings() {
  return databaseOperation(async () => {
    const [row] = await getDatabase()
      .select({
        siteTitle: seoSettings.siteTitle,
        indexingEnabled: seoSettings.indexingEnabled,
        pages: seoSettings.pages,
        titleTemplate: seoSettings.titleTemplate,
        defaultDescription: seoSettings.defaultDescription,
        defaultOgImage: seoSettings.defaultOgImage,
        homepageTitle: seoSettings.homepageTitle,
        homepageDescription: seoSettings.homepageDescription,
      })
      .from(seoSettings)
      .where(eq(seoSettings.id, 1));
    return row ?? null;
  });
}
export async function updateSeoSettings(input: unknown) {
  return withStaff("seo.manage", async (tx, actor) => {
    const data = seoInput.parse(input);
    await tx
      .insert(seoSettings)
      .values({ id: 1, ...data, updatedBy: actor.id })
      .onConflictDoUpdate({
        target: seoSettings.id,
        set: { ...data, updatedBy: actor.id, updatedAt: new Date() },
      });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "seo.updated",
      entityType: "seo_settings",
      entityId: "1",
      metadata: { changedFields: Object.keys(data) },
    });
    return { updated: true };
  });
}
export async function listBankAccounts() {
  return withStaff("settings.read", (tx) =>
    tx
      .select()
      .from(bankAccounts)
      .orderBy(asc(bankAccounts.sortOrder), asc(bankAccounts.id))
      .limit(100),
  );
}
export async function saveBankAccount(input: unknown) {
  return withStaff("settings.manage", async (tx, actor) => {
    const data = z
      .object({
        id: z.uuid().optional(),
        bankName: z.string().trim().min(1).max(120),
        accountNumber: z.string().regex(/^[0-9]{4,40}$/),
        accountHolder: z.string().trim().min(1).max(200),
        instructions: z.string().trim().max(2000).nullable().optional(),
        logoObjectKey: z.string().nullable().optional(),
        active: z.boolean(),
        sortOrder: z.number().int().min(0).max(1000),
      })
      .strict()
      .parse(input);
    const { id, ...values } = data;
    const rows = id
      ? await tx
          .update(bankAccounts)
          .set({ ...values, updatedBy: actor.id, updatedAt: new Date() })
          .where(eq(bankAccounts.id, id))
          .returning({ id: bankAccounts.id })
      : await tx
          .insert(bankAccounts)
          .values({ ...values, updatedBy: actor.id })
          .returning({ id: bankAccounts.id });
    const row = rows[0];
    if (!row) throw new AppError("NOT_FOUND");
    await writeAudit(tx, {
      actorId: actor.id,
      action: "bank.updated",
      entityType: "bank_account",
      entityId: row.id,
      metadata: { changedFields: Object.keys(values) },
    });
    return row;
  });
}
export async function deleteBankAccount(id: string) {
  return withStaff("settings.manage", async (tx, actor) => {
    z.uuid().parse(id);
    const referenced = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.bankAccountId, id))
      .limit(1);

    if (referenced.length > 0) {
      const [deactivated] = await tx
        .update(bankAccounts)
        .set({ active: false, updatedBy: actor.id, updatedAt: new Date() })
        .where(eq(bankAccounts.id, id))
        .returning({ id: bankAccounts.id });
      if (!deactivated) throw new AppError("NOT_FOUND");
      await writeAudit(tx, {
        actorId: actor.id,
        action: "bank.updated",
        entityType: "bank_account",
        entityId: deactivated.id,
        metadata: { changedFields: ["active"] },
      });
      return deactivated;
    }

    const [deleted] = await tx
      .delete(bankAccounts)
      .where(eq(bankAccounts.id, id))
      .returning({ id: bankAccounts.id });
    if (!deleted) throw new AppError("NOT_FOUND");
    await writeAudit(tx, {
      actorId: actor.id,
      action: "bank.deleted",
      entityType: "bank_account",
      entityId: deleted.id,
    });
    return deleted;
  });
}
export async function setStoreSettings(input: unknown) {
  return withStaff("settings.manage", async (tx, actor) => {
    const data = z
      .object({
        storeName: z.string().trim().min(1).max(200),
        description: z.string().trim().max(2000).nullable().optional(),
        footerText: z.string().trim().max(2000).nullable().optional(),
        logoObjectKey: z.string().max(200).nullable().optional(),
        faviconObjectKey: z.string().max(200).nullable().optional(),
        whatsappNumber: z
          .string()
          .regex(/^[1-9][0-9]{7,14}$/)
          .nullable(),
        supportEmail: z.email().nullable(),
        displayAddress: z.string().max(2000).nullable(),
        shippingOrigin: destinationSchema.nullable().optional(),
        reservationMinutes: z.number().int().min(1).max(10080).nullable(),
      })
      .strict()
      .parse(input);
    for (const key of [data.logoObjectKey, data.faviconObjectKey])
      if (key) await validateSiteImage(key);
    await tx
      .insert(storeSettings)
      .values({ id: 1, ...data, updatedBy: actor.id })
      .onConflictDoUpdate({
        target: storeSettings.id,
        set: { ...data, updatedBy: actor.id, updatedAt: new Date() },
      });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "store.updated",
      entityType: "store_settings",
      entityId: "1",
      metadata: { changedFields: Object.keys(data) },
    });
    return { updated: true };
  });
}
export async function getQrisSettings() {
  return databaseOperation(async () => {
    const [row] = await getDatabase()
      .select()
      .from(qrisSettings)
      .where(eq(qrisSettings.id, 1));
    return row ?? null;
  });
}
export async function saveQrisSettings(input: unknown) {
  return withStaff("settings.manage", async (tx, actor) => {
    const data = z
      .object({
        merchantName: z.string().trim().max(200).nullable().optional(),
        imageObjectKey: z.string().trim().nullable().optional(),
        instructions: z.string().trim().max(2000).nullable().optional(),
        active: z.boolean(),
      })
      .strict()
      .refine(
        (val) =>
          !val.active ||
          (Boolean(val.imageObjectKey) && val.imageObjectKey!.length > 0),
        { message: "Gambar QRIS wajib diunggah sebelum mengaktifkan QRIS." },
      )
      .parse(input);

    const imageKey = data.imageObjectKey || null;
    if (imageKey) {
      assertObjectKey(imageKey, "site-media");
      if (data.active) {
        const { validateSiteImage } = await import("./site-media");
        await validateSiteImage(imageKey);
      }
    }

    const payload = {
      merchantName: data.merchantName || null,
      imageObjectKey: imageKey,
      instructions: data.instructions || null,
      active: data.active,
    };

    await tx
      .insert(qrisSettings)
      .values({ id: 1, ...payload, updatedBy: actor.id })
      .onConflictDoUpdate({
        target: qrisSettings.id,
        set: { ...payload, updatedBy: actor.id, updatedAt: new Date() },
      });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "qris.updated",
      entityType: "qris_settings",
      entityId: "1",
      metadata: { changedFields: Object.keys(payload) },
    });
    return { updated: true };
  });
}

export async function getAdminSeoSettings() {
  return withStaff("seo.read", async (tx) => {
    const [row] = await tx
      .select()
      .from(seoSettings)
      .where(eq(seoSettings.id, 1));
    return row ?? null;
  });
}

export async function getAdminStoreSettings() {
  return withStaff("settings.read", async (tx) => {
    const [row] = await tx
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.id, 1));
    return row ?? null;
  });
}
export async function saveSocialSettings(input: unknown) {
  return withStaff("settings.manage", async (tx, actor) => {
    const socialLinks = socialInput.parse(input);
    const [row] = await tx
      .update(storeSettings)
      .set({ socialLinks, updatedBy: actor.id, updatedAt: new Date() })
      .where(eq(storeSettings.id, 1))
      .returning({ id: storeSettings.id });
    if (!row) throw new AppError("NOT_CONFIGURED");
    await writeAudit(tx, {
      actorId: actor.id,
      action: "social.updated",
      entityType: "store_settings",
      entityId: "1",
      metadata: { changedFields: Object.keys(socialLinks) },
    });
    return { updated: true };
  });
}
