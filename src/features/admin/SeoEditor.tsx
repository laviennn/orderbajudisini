"use client";
import { useState } from "react";
import type { SeoConfiguration, PageSeo } from "@/lib/seo-settings";
import { adminRequest, errorText } from "./http";
export function SeoEditor({
  initial,
  editable,
}: {
  initial: SeoConfiguration | null;
  editable: boolean;
}) {
  const [value, setValue] = useState<SeoConfiguration>(
    initial
      ? {
          siteTitle: initial.siteTitle,
          titleTemplate: initial.titleTemplate,
          defaultDescription: initial.defaultDescription,
          defaultOgImage: initial.defaultOgImage,
          homepageTitle: initial.homepageTitle,
          homepageDescription: initial.homepageDescription,
          indexingEnabled: initial.indexingEnabled,
          pages: initial.pages,
        }
      : {
          siteTitle: "",
          titleTemplate: "%s",
          defaultDescription: "",
          defaultOgImage: null,
          homepageTitle: null,
          homepageDescription: null,
          indexingEnabled: true,
          pages: [],
        },
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fields = [
    ["siteTitle", "Judul situs"],
    ["titleTemplate", "Template judul (%s)"],
    ["defaultDescription", "Deskripsi default"],
    ["defaultOgImage", "URL gambar Open Graph (HTTPS)"],
    ["homepageTitle", "Judul beranda"],
    ["homepageDescription", "Deskripsi beranda"],
  ] as const;
  const updatePage = (i: number, patch: Partial<PageSeo>) =>
    setValue({
      ...value,
      pages: value.pages.map((p, n) => (n === i ? { ...p, ...patch } : p)),
    });
  return (
    <form
      className="admin-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          await adminRequest("/api/admin/seo", value);
          setMessage("Pengaturan SEO disimpan.");
        } catch (error) {
          setMessage(errorText(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={!editable || busy}>
        <legend>Metadata global</legend>
        {fields.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={value[key] ?? ""}
              onChange={(e) =>
                setValue({
                  ...value,
                  [key]:
                    e.target.value ||
                    (key === "siteTitle" ||
                    key === "titleTemplate" ||
                    key === "defaultDescription"
                      ? ""
                      : null),
                })
              }
              required={key === "siteTitle" || key === "titleTemplate"}
            />
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={value.indexingEnabled}
            onChange={(e) =>
              setValue({ ...value, indexingEnabled: e.target.checked })
            }
          />
          Izinkan mesin pencari mengindeks halaman publik
        </label>
        <h2>Metadata per halaman</h2>
        <p>
          URL toko saja: /, /products, /products/slug atau /category/slug.
          Produk dan kategori juga memiliki judul/deskripsi di editornya.
        </p>
        {value.pages.map((p, i) => (
          <fieldset key={i}>
            <legend>Halaman {i + 1}</legend>
            {(
              [
                ["path", "URL halaman"],
                ["title", "Judul"],
                ["description", "Deskripsi"],
                ["image", "Gambar Open Graph HTTPS"],
                ["canonical", "Canonical (URL toko)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  required={key === "path"}
                  value={p[key] ?? ""}
                  onChange={(e) =>
                    updatePage(i, {
                      [key]: e.target.value || (key === "path" ? "" : null),
                    })
                  }
                />
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                checked={p.noindex}
                onChange={(e) => updatePage(i, { noindex: e.target.checked })}
              />
              Jangan indeks halaman ini
            </label>
            <button
              type="button"
              onClick={() =>
                setValue({
                  ...value,
                  pages: value.pages.filter((_, n) => n !== i),
                })
              }
            >
              Hapus override
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() =>
            setValue({
              ...value,
              pages: [
                ...value.pages,
                {
                  path: "",
                  title: null,
                  description: null,
                  image: null,
                  canonical: null,
                  noindex: false,
                },
              ],
            })
          }
        >
          Tambah halaman
        </button>
        <button className="primary-action" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan SEO"}
        </button>
      </fieldset>
      <p role="status">{message}</p>
      <section aria-label="Pratinjau hasil pencarian">
        <h2>Pratinjau beranda</h2>
        <h3>{value.homepageTitle || value.siteTitle}</h3>
        <p>{value.homepageDescription || value.defaultDescription}</p>
      </section>
    </form>
  );
}
