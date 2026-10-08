import "server-only";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getDatabase } from "@/server/db";
import { databaseOperation } from "@/server/db/operations";
import { withStaff } from "@/server/auth/authorize";
import { bankAccounts, seoSettings, storeSettings, qrisSettings } from "@/server/db/schema";
import { destinationSchema } from "@/server/shipping/contract";
import { writeAudit } from "./audit";
export const seoInput = z
  .object({
    siteTitle: z.string().trim().min(1).max(300),
    titleTemplate: z
      .string()
      .min(1)
      .max(300)
      .refine((s) => s.includes("%s")),
    defaultDescription: z.string().trim().max(2000),
    defaultOgImage: z
      .url()
      .refine((v) => v.startsWith("https://"))
      .nullable(),
    homepageTitle: z.string().max(300).nullable(),
    homepageDescription: z.string().max(2000).nullable(),
  })
  .strict();
export async function getPublicSeoSettings() {
  return databaseOperation(async () => {
    const [row] = await getDatabase()
      .select({
        siteTitle: seoSettings.siteTitle,
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
export async function setStoreSettings(input: unknown) {
  return withStaff("settings.manage", async (tx, actor) => {
    const data = z
      .object({
        storeName: z.string().trim().min(1).max(200),
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
        imageObjectKey: z.string().trim().min(1),
        instructions: z.string().trim().max(2000).nullable().optional(),
        active: z.boolean(),
      })
      .strict()
      .parse(input);
    await tx
      .insert(qrisSettings)
      .values({ id: 1, ...data, updatedBy: actor.id })
      .onConflictDoUpdate({
        target: qrisSettings.id,
        set: { ...data, updatedBy: actor.id, updatedAt: new Date() },
      });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "qris.updated",
      entityType: "qris_settings",
      entityId: "1",
      metadata: { changedFields: Object.keys(data) },
    });
    return { updated: true };
  });
}
