"use client";
import { useState, useTransition, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, errorText } from "./http";
import { initialSlug } from "./validation";
type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
};
export function CategoryEditor({
  categories,
  writable,
}: {
  categories: Category[];
  writable: boolean;
}) {
  const [selected, setSelected] = useState<Category | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const slugEdited = useRef(false);
  const [refreshing, startTransition] = useTransition();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const text = (key: string) => String(fd.get(key) ?? "");
    setBusy(true);
    setError("");
    try {
      await adminRequest("/api/admin/categories", {
        ...(selected ? { id: selected.id, updatedAt: selected.updatedAt } : {}),
        name: text("name"),
        slug: text("slug"),
        description: text("description"),
        active: fd.get("active") === "on",
        sortOrder: Number(text("sortOrder")),
        seoTitle: text("seoTitle"),
        seoDescription: text("seoDescription"),
        confirmSlugChange: fd.get("confirmSlugChange") === "on",
      });
      setSelected(null);
      slugEdited.current = false;
      form.reset();
      setMessage("Kategori tersimpan.");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="category-admin-layout">
      <div>
        <ul className="admin-recent">
          {categories.map((c) => (
            <li key={c.id}>
              <button
                className="text-link"
                disabled={busy || refreshing}
                onClick={() => {
                  setSelected(c);
                  setError("");
                  setMessage("");
                }}
              >
                {c.name}
              </button>
              <span>
                {c.active ? "Aktif" : "Nonaktif"} · {c.sortOrder}
              </span>
            </li>
          ))}
        </ul>
        <button
          className="primary-action"
          disabled={!writable || busy || refreshing}
          onClick={() => {
            setSelected(null);
            slugEdited.current = false;
            setError("");
            setMessage("");
          }}
        >
          Kategori baru
        </button>
      </div>
      <form
        key={selected?.id ?? "new"}
        className="admin-editor"
        onSubmit={save}
      >
        <h2>{selected ? "Edit kategori" : "Kategori baru"}</h2>
        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <fieldset disabled={!writable || busy || refreshing}>
          <label>
            Nama kategori
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={selected?.name ?? ""}
              onChange={(e) => {
                if (!selected && !slugEdited.current) {
                  const slug = e.currentTarget.form?.elements.namedItem("slug");
                  if (slug instanceof HTMLInputElement)
                    slug.value = initialSlug(e.target.value);
                }
              }}
            />
          </label>
          <label>
            Slug kategori
            <input
              name="slug"
              onChange={() => {
                slugEdited.current = true;
              }}
              required
              maxLength={160}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              defaultValue={selected?.slug ?? ""}
            />
          </label>
          {selected && (
            <label className="checkbox-label">
              <input type="checkbox" name="confirmSlugChange" />
              Konfirmasi jika mengubah URL kategori; redirect otomatis belum
              tersedia.
            </label>
          )}
          <label>
            Deskripsi kategori
            <textarea
              name="description"
              rows={4}
              maxLength={5000}
              defaultValue={selected?.description ?? ""}
            />
          </label>
          <label>
            Urutan kategori
            <input
              name="sortOrder"
              type="number"
              min="0"
              max="10000"
              required
              defaultValue={selected?.sortOrder ?? 0}
            />
          </label>
          <label className="checkbox-label">
            <input
              name="active"
              type="checkbox"
              defaultChecked={selected?.active ?? true}
            />
            Kategori aktif
          </label>
          <p className="small-note">
            Menonaktifkan kategori menyembunyikan produk terkait dari
            storefront. Produk tidak dihapus.
          </p>
          <label>
            Judul SEO kategori
            <input
              name="seoTitle"
              maxLength={1000}
              defaultValue={selected?.seoTitle ?? ""}
            />
          </label>
          <label>
            Meta description kategori
            <textarea
              name="seoDescription"
              rows={3}
              maxLength={3000}
              defaultValue={selected?.seoDescription ?? ""}
            />
          </label>
          <button className="primary-action">
            {busy ? "Menyimpan…" : "Simpan kategori"}
          </button>
        </fieldset>
      </form>
    </div>
  );
}
