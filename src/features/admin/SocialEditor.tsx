"use client";
import { useState } from "react";
import type { SocialSettings } from "@/lib/social-settings";
import { adminRequest, errorText } from "./http";
export function SocialEditor({
  initial,
  editable,
}: {
  initial: SocialSettings | null;
  editable: boolean;
}) {
  const [value, setValue] = useState(
    initial ?? {
      instagram: null,
      tiktok: null,
      facebook: null,
      whatsapp: null,
    },
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className="admin-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await adminRequest("/api/admin/social-media", value);
          setMessage("Media sosial disimpan.");
        } catch (error) {
          setMessage(errorText(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={!editable || busy}>
        <legend>Tautan footer</legend>
        <p>
          Kosongkan untuk menyembunyikan tautan. Simpan identitas toko dahulu
          sebelum menambahkan media sosial.
        </p>
        {(
          [
            ["instagram", "Instagram (URL HTTPS)"],
            ["tiktok", "TikTok (URL HTTPS)"],
            ["facebook", "Facebook (URL HTTPS)"],
            ["whatsapp", "WhatsApp (nomor 62…, tanpa +)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type={key === "whatsapp" ? "tel" : "url"}
              value={value[key] ?? ""}
              onChange={(e) =>
                setValue({ ...value, [key]: e.target.value || null })
              }
            />
          </label>
        ))}
        <button className="primary-action">
          {busy ? "Menyimpan…" : "Simpan media sosial"}
        </button>
      </fieldset>
      <p role="status">{message}</p>
    </form>
  );
}
