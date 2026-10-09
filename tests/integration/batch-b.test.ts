import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { startTestDatabase } from "./database";
import * as s from "@/server/db/schema";
let database: Awaited<ReturnType<typeof startTestDatabase>>;
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/server/db", () => ({ getDatabase: () => database.db }));
vi.mock("@/server/auth", () => ({ auth, authenticationEnabled: () => true }));
import { bootstrapOwner } from "@/server/services/bootstrap";
import { createOperator } from "@/server/services/operators";
import {
  getAdminSeoSettings,
  updateSeoSettings,
} from "@/server/services/settings";
let owner: string, operator: string;
const login = (id: string) =>
  auth.mockResolvedValue({ user: { id, sessionVersion: 0 } });
beforeAll(async () => {
  database = await startTestDatabase();
  const result = await bootstrapOwner(database.db, {
    name: "TEST Owner",
    email: "batch-b@test.invalid",
    password: "TEST batch B owner password",
  });
  owner = result.id;
  login(owner);
  const [role] = await database.db
    .select()
    .from(s.roles)
    .where(eq(s.roles.name, "Order Operator"));
  const created = await createOperator({
    name: "TEST Order",
    email: "batch-b-operator@test.invalid",
    password: "TEST batch B operator password",
    roleId: role!.id,
  });
  operator = created.id;
});
afterAll(async () => {
  await database?.stop();
});
it("persists SEO configuration with audit and rejects unauthorized mutation", async () => {
  login(owner);
  const input = {
    siteTitle: "TEST Store",
    titleTemplate: "%s | TEST",
    defaultDescription: "TEST only",
    defaultOgImage: null,
    homepageTitle: null,
    homepageDescription: null,
    indexingEnabled: false,
    pages: [],
  };
  await updateSeoSettings(input);
  expect(await getAdminSeoSettings()).toMatchObject(input);
  const audit = await database.db
    .select()
    .from(s.auditLogs)
    .where(eq(s.auditLogs.action, "seo.updated"));
  expect(audit).toHaveLength(1);
  login(operator);
  await expect(updateSeoSettings(input)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(getAdminSeoSettings()).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});

import sharp from "sharp";
import { randomUUID } from "node:crypto";
const media = new Map<string, Buffer>();
vi.mock("@/server/storage/r2", () => ({
  getStorage: () => ({
    inspectObject: async (_purpose: string, key: string) => {
      const body = media.get(key);
      if (!body) throw new Error("TEST missing");
      return { bytes: body.length, mime: "image/png" };
    },
    readSiteMedia: async (key: string) => media.get(key),
    publicMediaUrl: (key: string) => `https://media.example.invalid/${key}`,
  }),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import {
  saveBanner,
  listBanners,
  deleteBanner,
} from "@/server/services/banners";
import { saveQrisSettings } from "@/server/services/settings";
import { readBanner } from "@/server/services/storefront";
it("validates real image bytes for banners and QRIS, enforces scheduling and CRUD permissions", async () => {
  login(owner);
  const key = `site-media/${randomUUID()}.png`;
  media.set(key, Buffer.from("TEST not an image"));
  const banner = {
    internalName: "TEST Banner",
    headline: "TEST headline",
    body: null,
    imageObjectKey: key,
    mobileImageObjectKey: null,
    ctaLabel: "TEST Shop",
    ctaUrl: "/products",
    active: true,
    sortOrder: 1,
    startsAt: null,
    endsAt: null,
  };
  await expect(saveBanner(banner)).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
  await expect(
    saveQrisSettings({ imageObjectKey: key, active: true }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  media.set(
    key,
    await sharp({
      create: { width: 32, height: 32, channels: 3, background: "white" },
    })
      .png()
      .toBuffer(),
  );
  await saveQrisSettings({ imageObjectKey: key, active: true });
  await expect(
    saveQrisSettings({
      imageObjectKey: `site-media/${randomUUID()}.png`,
      active: true,
    }),
  ).rejects.toBeDefined();
  const saved = await saveBanner(banner);
  expect(await readBanner()).toMatchObject({
    headline: "TEST headline",
    image: `https://media.example.invalid/${key}`,
  });
  await saveBanner({
    ...banner,
    id: saved.id,
    startsAt: "2099-01-01T00:00:00.000Z",
  });
  expect(await readBanner()).toBeNull();
  await expect(
    saveBanner({
      ...banner,
      startsAt: "2099-01-02T00:00:00.000Z",
      endsAt: "2099-01-01T00:00:00.000Z",
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(await listBanners()).toHaveLength(1);
  login(operator);
  await expect(saveBanner(banner)).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(deleteBanner(saved)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  login(owner);
  await deleteBanner(saved);
  expect(await listBanners()).toHaveLength(0);
});

import {
  getAdminStoreSettings,
  setStoreSettings,
  saveSocialSettings,
} from "@/server/services/settings";
it("persists store identity/origin and social links independently with RBAC", async () => {
  login(owner);
  const origin = {
    province: "TEST",
    city: "TEST",
    district: "TEST",
    subdistrict: null,
    postalCode: "00000",
    providerDestinationId: "TEST-1",
  };
  await setStoreSettings({
    storeName: "TEST Batch B",
    description: "TEST description",
    footerText: "TEST footer",
    whatsappNumber: "6281234567890",
    supportEmail: "support@test.invalid",
    displayAddress: "TEST address",
    shippingOrigin: origin,
    reservationMinutes: 30,
  });
  const social = {
    instagram: "https://www.instagram.com/test",
    tiktok: "https://www.tiktok.com/@test",
    facebook: null,
    whatsapp: "6281234567890",
  };
  await saveSocialSettings(social);
  expect(await getAdminStoreSettings()).toMatchObject({
    storeName: "TEST Batch B",
    shippingOrigin: origin,
    socialLinks: social,
  });
  await expect(
    saveSocialSettings({
      ...social,
      instagram: "https://instagram.com.evil.invalid/test",
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await expect(
    setStoreSettings({
      storeName: "TEST",
      whatsappNumber: null,
      supportEmail: null,
      displayAddress: null,
      reservationMinutes: 30,
      shippingOrigin: { ...origin, postalCode: "wrong" },
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  login(operator);
  await expect(saveSocialSettings(social)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(setStoreSettings({})).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
