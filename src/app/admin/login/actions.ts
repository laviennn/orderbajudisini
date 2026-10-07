"use server";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, authenticationEnabled } from "@/server/auth";
export async function loginAction(
  _previous: { error: string },
  form: FormData,
) {
  if (!authenticationEnabled()) return { error: "Login staf belum tersedia." };
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
  } catch (error) {
    if (!(error instanceof AuthError))
      console.error({ event: "staff_login_action_failed" });
    return {
      error: "Tidak dapat masuk. Periksa kredensial atau coba lagi nanti.",
    };
  }
  redirect("/admin");
}
