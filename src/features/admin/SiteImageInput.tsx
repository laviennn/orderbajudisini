"use client";
import Image from "next/image";
import { useState } from "react";
import { adminRequest, errorText } from "./http";
export function SiteImageInput({
  label,
  value,
  url,
  scope,
  onChange,
  onBusy,
}: {
  label: string;
  value: string | null;
  url?: string | null;
  scope: "banner" | "store";
  onChange: (key: string | null, url: string | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div>
      <label>
        {label}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            onBusy(true);
            setMessage("Mengunggah…");
            try {
              const signed = await adminRequest<{
                key: string;
                url: string;
                headers: Record<string, string>;
              }>("/api/admin/site-media", {
                scope,
                action: "authorize",
                data: { mime: file.type, bytes: file.size },
              });
              const response = await fetch(signed.url, {
                method: "PUT",
                headers: signed.headers,
                body: file,
              });
              if (!response.ok) throw new Error();
              const accepted = await adminRequest<{ key: string; url: string }>(
                "/api/admin/site-media",
                { scope, action: "complete", data: { key: signed.key } },
              );
              onChange(accepted.key, accepted.url);
              setMessage("Gambar siap. Simpan perubahan untuk menerapkannya.");
            } catch (error) {
              setMessage(errorText(error));
            } finally {
              setBusy(false);
              onBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {url && (
        <Image
          unoptimized
          src={url}
          alt={label}
          width={240}
          height={160}
          style={{ objectFit: "contain", maxWidth: "100%" }}
        />
      )}
      {value && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onChange(null, null)}
        >
          Lepas gambar
        </button>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
