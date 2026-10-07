import type { Metadata } from "next";
import Link from "next/link";
import { authenticationEnabled } from "@/server/auth";
import { LoginForm } from "./LoginForm";
export const metadata: Metadata = { title: "Akses staf" };
export const dynamic = "force-dynamic";
export default function StaffLoginPage() {
  const enabled = authenticationEnabled();
  return (
    <main id="main-content" className="page-width py-16 sm:py-24">
      <div className="max-w-xl">
        <p className="eyebrow mb-6 text-muted-foreground">Administrasi</p>
        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">
          {enabled ? "Masuk sebagai staf" : "Akses staf belum tersedia."}
        </h1>
        {enabled ? (
          <>
            <p className="mt-6 text-muted-foreground">
              Gunakan akun yang diberikan pengelola toko.
            </p>
            <LoginForm />
          </>
        ) : (
          <p className="mt-6 text-muted-foreground">
            Login staf belum diaktifkan. Hubungi pengelola toko untuk informasi
            akses.
          </p>
        )}
        <Link className="text-link mt-8" href="/">
          Kembali ke halaman utama
        </Link>
      </div>
    </main>
  );
}
