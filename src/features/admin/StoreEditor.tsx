"use client";
import { useState } from "react";
import type { ShippingDestination } from "@/server/shipping/contract";
import { adminRequest, errorText } from "./http";
import { SiteImageInput } from "./SiteImageInput";
type Store = {
  storeName: string;
  description: string | null;
  footerText: string | null;
  whatsappNumber: string | null;
  supportEmail: string | null;
  displayAddress: string | null;
  logoObjectKey: string | null;
  faviconObjectKey: string | null;
  reservationMinutes: number | null;
  shippingOrigin: ShippingDestination | null;
};
export function StoreEditor({
  initial,
  editable,
  logoUrl,
  faviconUrl,
}: {
  initial: Store;
  editable: boolean;
  logoUrl: string | null;
  faviconUrl: string | null;
}) {
  const [value, setValue] = useState<Store>({
    storeName: initial.storeName,
    description: initial.description,
    footerText: initial.footerText,
    whatsappNumber: initial.whatsappNumber,
    supportEmail: initial.supportEmail,
    displayAddress: initial.displayAddress,
    logoObjectKey: initial.logoObjectKey,
    faviconObjectKey: initial.faviconObjectKey,
    reservationMinutes: initial.reservationMinutes,
    shippingOrigin: initial.shippingOrigin,
  });
  const [images, setImages] = useState({ logoUrl, faviconUrl });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const origin = value.shippingOrigin;
  return (
    <form
      className="admin-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await adminRequest("/api/admin/store-settings", value);
          setMessage("Pengaturan toko disimpan.");
        } catch (error) {
          setMessage(errorText(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={!editable || busy || uploading}>
        <legend>Identitas dan kontak</legend>
        {(
          [
            ["storeName", "Nama toko"],
            ["description", "Deskripsi"],
            ["footerText", "Teks footer"],
            ["whatsappNumber", "Telepon/WhatsApp (62…)"],
            ["supportEmail", "Email dukungan"],
            ["displayAddress", "Alamat publik"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type={key === "supportEmail" ? "email" : "text"}
              required={key === "storeName"}
              value={value[key] ?? ""}
              onChange={(e) =>
                setValue({
                  ...value,
                  [key]: e.target.value || (key === "storeName" ? "" : null),
                })
              }
            />
          </label>
        ))}
        <SiteImageInput
          label="Logo toko"
          scope="store"
          value={value.logoObjectKey}
          url={images.logoUrl}
          onBusy={setUploading}
          onChange={(key, url) => {
            setValue((v) => ({ ...v, logoObjectKey: key }));
            setImages((v) => ({ ...v, logoUrl: url }));
          }}
        />
        <SiteImageInput
          label="Favicon (gambar persegi PNG/WebP)"
          scope="store"
          value={value.faviconObjectKey}
          url={images.faviconUrl}
          onBusy={setUploading}
          onChange={(key, url) => {
            setValue((v) => ({ ...v, faviconObjectKey: key }));
            setImages((v) => ({ ...v, faviconUrl: url }));
          }}
        />
        <label>
          Batas pembayaran/reservasi (menit)
          <input
            type="number"
            min="1"
            max="10080"
            value={value.reservationMinutes ?? ""}
            onChange={(e) =>
              setValue({
                ...value,
                reservationMinutes: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
        </label>
        <h2>Asal pengiriman</h2>
        <p>
          Data ini dipakai untuk perhitungan ongkir. ID tujuan harus sesuai
          provider pengiriman yang dikonfigurasi.
        </p>
        <label>
          <input
            type="checkbox"
            checked={Boolean(origin)}
            onChange={(e) =>
              setValue({
                ...value,
                shippingOrigin: e.target.checked
                  ? {
                      province: "",
                      city: "",
                      district: "",
                      subdistrict: null,
                      postalCode: "",
                      providerDestinationId: null,
                    }
                  : null,
              })
            }
          />
          Konfigurasikan asal pengiriman
        </label>
        {origin &&
          (
            [
              ["province", "Provinsi"],
              ["city", "Kota/kabupaten"],
              ["district", "Kecamatan"],
              ["subdistrict", "Kelurahan/desa"],
              ["postalCode", "Kode pos"],
              ["providerDestinationId", "ID tujuan provider"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required={[
                  "province",
                  "city",
                  "district",
                  "postalCode",
                ].includes(key)}
                value={origin[key] ?? ""}
                onChange={(e) =>
                  setValue({
                    ...value,
                    shippingOrigin: {
                      ...origin,
                      [key]:
                        e.target.value ||
                        (["subdistrict", "providerDestinationId"].includes(key)
                          ? null
                          : ""),
                    },
                  })
                }
              />
            </label>
          ))}
        <button className="primary-action">
          {busy ? "Menyimpan…" : "Simpan toko"}
        </button>
      </fieldset>
      <p role="status">{message}</p>
    </form>
  );
}
