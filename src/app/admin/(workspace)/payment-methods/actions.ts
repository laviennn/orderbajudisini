"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { withStaff } from "@/server/auth/authorize";
import { getStorage } from "@/server/storage/r2";
import { uploadSchema } from "@/server/storage/policy";
import {
  saveBankAccount,
  deleteBankAccount,
  saveQrisSettings,
} from "@/server/services/settings";

export async function authorizeQrisUploadAction(input: {
  mime: string;
  bytes: number;
}) {
  return withStaff("settings.manage", async () => {
    const valid = uploadSchema.safeParse({
      purpose: "site-media",
      mime: input.mime,
      bytes: input.bytes,
    });
    if (!valid.success) {
      throw new AppError("VALIDATION_ERROR", {
        file: ["Format file harus JPG, PNG, atau WebP maksimal 10 MB."],
      });
    }
    const signed = await getStorage().createUpload({
      purpose: "site-media",
      mime: valid.data.mime,
      bytes: valid.data.bytes,
    });
    return signed;
  });
}

export async function saveQrisSettingsAction(data: {
  merchantName?: string | null;
  imageObjectKey?: string | null;
  instructions?: string | null;
  active: boolean;
}) {
  await saveQrisSettings(data);
  revalidatePath("/admin/payment-methods");
  return { success: true };
}

export async function authorizeBankLogoUploadAction(input: {
  mime: string;
  bytes: number;
}) {
  return withStaff("settings.manage", async () => {
    const valid = uploadSchema.safeParse({
      purpose: "site-media",
      mime: input.mime,
      bytes: input.bytes,
    });
    if (!valid.success) {
      throw new AppError("VALIDATION_ERROR", {
        file: ["Format file harus JPG, PNG, atau WebP maksimal 10 MB."],
      });
    }
    const signed = await getStorage().createUpload({
      purpose: "site-media",
      mime: valid.data.mime,
      bytes: valid.data.bytes,
    });
    return signed;
  });
}

export async function submitBankAccountAction(formData: FormData) {
  try {
    const idValue = formData.get("id");
    const logoKeyRaw = formData.get("logoObjectKey");
    const data = {
      id: idValue ? String(idValue) : undefined,
      bankName: String(formData.get("bankName") || ""),
      accountNumber: String(formData.get("accountNumber") || "").replace(
        /\D/g,
        "",
      ),
      accountHolder: String(formData.get("accountHolder") || ""),
      instructions: formData.get("instructions")
        ? String(formData.get("instructions"))
        : null,
      logoObjectKey: logoKeyRaw ? String(logoKeyRaw) : null,
      active:
        formData.get("active") === "true" || formData.get("active") === "on",
      sortOrder: parseInt(String(formData.get("sortOrder") || "0"), 10),
    };
    await saveBankAccount(data);
    revalidatePath("/admin/payment-methods");
  } catch (error) {
    console.error("submitBankAccountAction Error:", error);
    throw error;
  }
}

export async function deleteBankAccountAction(formData: FormData) {
  const id = formData.get("id");
  if (id) {
    await deleteBankAccount(String(id));
    revalidatePath("/admin/payment-methods");
  }
}
