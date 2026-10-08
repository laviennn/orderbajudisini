import { revalidatePath } from "next/cache";
import { saveBankAccount, saveQrisSettings } from "@/server/services/settings";

export async function submitBankAccountAction(formData: FormData) {
  const data = {
    id: formData.get("id") || undefined,
    bankName: formData.get("bankName"),
    accountNumber: formData.get("accountNumber"),
    accountHolder: formData.get("accountHolder"),
    instructions: formData.get("instructions") || null,
    active: formData.get("active") === "true",
    sortOrder: parseInt(formData.get("sortOrder") as string || "0"),
  };
  await saveBankAccount(data);
  revalidatePath("/admin/payment-methods");
}

export async function submitQrisSettingsAction(formData: FormData) {
  const data = {
    merchantName: formData.get("merchantName") || null,
    imageObjectKey: formData.get("imageObjectKey"),
    instructions: formData.get("instructions") || null,
    active: formData.get("active") === "true",
  };
  await saveQrisSettings(data);
  revalidatePath("/admin/payment-methods");
}


