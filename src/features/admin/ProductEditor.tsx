"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { adminProduct } from "@/server/services/admin-products";
import { initialSlug } from "./validation";
import { adminRequest, errorText } from "./http";
import { MediaUploader } from "./MediaUploader";
type Product = Awaited<ReturnType<typeof adminProduct>>;
export function ProductEditor({
  product,
  categories,
  rights,
}: {
  product: Product | null;
  categories: { id: string; name: string; active: boolean }[];
  rights: {
    edit: boolean;
    media: boolean;
    publish: boolean;
    archive: boolean;
    promotion: boolean;
  };
}) {
  const router = useRouter();
  const slugEdited = useRef(Boolean(product));
  const [revision, setRevision] = useState(product?.updatedAt);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [measurements, setMeasurements] = useState(() =>
    (product?.measurements ?? []).map((m, i) => ({
      ...m,
      rowId: `existing-${i}`,
    })),
  );
  const locked = product?.status === "sold" || product?.status === "reserved";
  const editable = rights.edit && !locked;
  const field = (
    name: keyof NonNullable<typeof product>,
    label: string,
    options: { required?: boolean; type?: string; maxLength?: number } = {},
  ) => (
    <label>
      {label}
      <input
        name={name}
        defaultValue={String(product?.[name] ?? "")}
        type={options.type || "text"}
        required={options.required}
        maxLength={options.maxLength}
        min={options.type === "number" ? 0 : undefined}
        step={options.type === "number" ? 1 : undefined}
      />
    </label>
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const text = (key: string) => String(fd.get(key) ?? "");
    const optionalNumber = (key: string) =>
      text(key) === "" ? null : Number(text(key));
    const data = {
      ...(product ? { id: product.id, updatedAt: revision } : {}),
      confirmSlugChange: fd.get("confirmSlugChange") === "on",
      name: text("name"),
      sku: text("sku"),
      slug: text("slug"),
      categoryId: text("categoryId"),
      brand: text("brand"),
      description: text("description"),
      shortDescription: text("shortDescription"),
      price: Number(text("price")),
      compareAtPrice: optionalNumber("compareAtPrice"),
      sizeLabel: text("sizeLabel"),
      conditionGrade: text("conditionGrade"),
      conditionNotes: text("conditionNotes"),
      defectNotes: text("defectNotes"),
      quantity: Number(text("quantity")),
      weightGrams: optionalNumber("weightGrams"),
      promotionEligible: rights.promotion
        ? fd.get("promotionEligible") === "on"
        : (product?.promotionEligible ?? false),
      seoTitle: text("seoTitle"),
      seoDescription: text("seoDescription"),
      measurements: measurements.map((m) => ({
        key: m.key,
        label: text(`${m.rowId}-label`),
        value: Number(text(`${m.rowId}-value`)),
        unit: text(`${m.rowId}-unit`),
      })),
    };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await adminRequest<{ id: string; updatedAt: string }>(
        "/api/admin/products",
        data,
      );
      setRevision(result.updatedAt);
      setDirty(false);
      setMessage("Produk tersimpan.");
      if (!product) router.replace(`/admin/products/${result.id}/edit`);
      else router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function status(action: "publish" | "draft" | "archive") {
    if (!product) return;
    if (
      (dirty || action !== "publish") &&
      !window.confirm(
        `${dirty ? "Ada perubahan yang belum disimpan. " : ""}Tindakan ini menggunakan data terakhir yang tersimpan. Lanjutkan?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(`/api/admin/products/${product.id}/status`, {
        action,
        updatedAt: revision,
      });
      window.location.reload();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <h1>{product ? "Edit produk" : "Tambah produk"}</h1>
        {product && (
          <Link
            className="text-link"
            href={`/admin/products/${product.id}/preview`}
            target="_blank"
            rel="noopener"
          >
            Preview data tersimpan
          </Link>
        )}
      </div>
      {product && (
        <p className="small-note">
          Status: {product.status}.{" "}
          {locked
            ? "Produk terjual/dipesan dikunci dari perubahan katalog."
            : "Media dikelola terpisah dari formulir informasi."}
        </p>
      )}
      {!categories.length && (
        <p role="alert">Buat kategori terlebih dahulu di menu Kategori.</p>
      )}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <form
        className="admin-editor"
        onSubmit={save}
        onChange={() => setDirty(true)}
      >
        <fieldset disabled={!editable || busy}>
          <legend>Informasi dasar</legend>
          <div className="editor-grid">
            <label>
              Nama produk
              <input
                name="name"
                required
                maxLength={200}
                defaultValue={product?.name ?? ""}
                onChange={(e) => {
                  if (!slugEdited.current) {
                    const input =
                      e.currentTarget.form?.elements.namedItem("slug");
                    if (input instanceof HTMLInputElement)
                      input.value = initialSlug(e.currentTarget.value);
                  }
                }}
              />
            </label>
            {field("sku", "SKU", { required: true, maxLength: 80 })}
            <label>
              Slug / URL
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={160}
                defaultValue={product?.slug ?? ""}
                onChange={() => {
                  slugEdited.current = true;
                }}
              />
            </label>
            <label>
              Kategori
              <select
                name="categoryId"
                required
                defaultValue={product?.categoryId ?? ""}
              >
                <option value="" disabled>
                  Pilih kategori
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!c.active ? " (nonaktif)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {field("brand", "Merek (opsional)", { maxLength: 100 })}
          </div>
          {product?.publishedAt && (
            <label className="checkbox-label">
              <input type="checkbox" name="confirmSlugChange" />
              Saya memahami perubahan slug memutus URL lama; redirect otomatis
              belum tersedia.
            </label>
          )}
          <label>
            Deskripsi
            <textarea
              name="description"
              required
              maxLength={10000}
              rows={5}
              defaultValue={product?.description ?? ""}
            />
          </label>
          <label>
            Deskripsi singkat (opsional)
            <textarea
              name="shortDescription"
              maxLength={500}
              rows={2}
              defaultValue={product?.shortDescription ?? ""}
            />
          </label>
        </fieldset>
        <fieldset disabled={!editable || busy}>
          <legend>Harga & stok</legend>
          <div className="editor-grid">
            {field("price", "Harga (Rp)", { required: true, type: "number" })}
            {field("compareAtPrice", "Harga pembanding (opsional, Rp)", {
              type: "number",
            })}
            <label>
              Jumlah tersedia
              <input
                name="quantity"
                type="number"
                min="0"
                max="10000"
                step="1"
                required
                defaultValue={product?.quantity ?? 1}
              />
            </label>
            {field("weightGrams", "Berat (gram, opsional)", { type: "number" })}
          </div>
          <p className="small-note">
            Gunakan angka rupiah utuh, contoh 100000. Harga pembanding hanya
            diisi jika memiliki dasar yang benar.
          </p>
        </fieldset>
        <fieldset disabled={!editable || busy}>
          <legend>Ukuran & pengukuran</legend>
          {field("sizeLabel", "Label ukuran", { maxLength: 60 })}
          <div className="measurement-editor">
            {measurements.map((m, i) => (
              <div className="measurement-row" key={m.rowId}>
                <label>
                  Nama pengukuran {i + 1}
                  <input
                    name={`${m.rowId}-label`}
                    defaultValue={m.label}
                    placeholder="Lebar dada"
                    required
                  />
                </label>
                <label>
                  Nilai {i + 1}
                  <input
                    name={`${m.rowId}-value`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={m.value || ""}
                    required
                  />
                </label>
                <label>
                  Satuan {i + 1}
                  <input
                    name={`${m.rowId}-unit`}
                    defaultValue={m.unit}
                    maxLength={12}
                    required
                  />
                </label>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setMeasurements((rows) =>
                      rows.filter((r) => r.rowId !== m.rowId),
                    );
                    setDirty(true);
                  }}
                  aria-label={`Hapus pengukuran ${i + 1}`}
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="text-link"
            disabled={measurements.length >= 30}
            onClick={() => {
              setMeasurements((rows) => [
                ...rows,
                {
                  rowId: crypto.randomUUID(),
                  key: `measurement_${crypto.randomUUID().replaceAll("-", "")}`,
                  label: "",
                  value: 0,
                  unit: "cm",
                },
              ]);
              setDirty(true);
            }}
          >
            Tambah pengukuran
          </button>
        </fieldset>
        <fieldset disabled={!editable || busy}>
          <legend>Kondisi & cacat</legend>
          {field("conditionGrade", "Grade kondisi", { maxLength: 80 })}
          <label>
            Catatan kondisi
            <textarea
              name="conditionNotes"
              rows={3}
              required
              maxLength={5000}
              defaultValue={product?.conditionNotes ?? ""}
            />
          </label>
          <label>
            Catatan cacat (jika ada)
            <textarea
              name="defectNotes"
              rows={3}
              maxLength={5000}
              defaultValue={product?.defectNotes ?? ""}
            />
          </label>
        </fieldset>
        <fieldset disabled={!editable || busy}>
          <legend>Harga promosi (internal)</legend>
          <label className="checkbox-label">
            <input
              name="promotionEligible"
              type="checkbox"
              disabled={!rights.promotion}
              defaultChecked={product?.promotionEligible ?? false}
            />
            Eligible untuk harga bundle
          </label>
          <p className="small-note">
            Hanya berpengaruh jika kampanye bundle aktif dan sesuai. Tidak
            menambah badge promosi di storefront.
            {!rights.promotion &&
              " Perubahan memerlukan izin promotions.manage."}
          </p>
        </fieldset>
        <fieldset disabled={!editable || busy}>
          <legend>SEO produk</legend>
          {field("seoTitle", "Judul SEO", { maxLength: 1000 })}
          <label>
            Meta description
            <textarea
              name="seoDescription"
              rows={3}
              maxLength={3000}
              defaultValue={product?.seoDescription ?? ""}
            />
          </label>
          <p className="small-note">
            Panduan: judul sekitar 50–60 karakter, deskripsi sekitar 140–160.
            Tampilan mesin pencari dapat berbeda.
          </p>
        </fieldset>
        <div className="editor-actions">
          <button
            className="primary-action"
            disabled={!editable || busy || !categories.length}
          >
            {busy
              ? "Menyimpan…"
              : product
                ? "Simpan perubahan"
                : "Simpan draft"}
          </button>
          {dirty && (
            <span className="small-note">Ada perubahan belum disimpan.</span>
          )}
        </div>
      </form>
      {product ? (
        <>
          <MediaUploader
            productId={product.id}
            productName={product.name}
            initialImages={product.images}
            enabled={rights.media && editable}
            canCleanup={rights.media}
          />
          <section className="admin-status-actions">
            <h2>Status publikasi</h2>
            <p className="small-note">
              Tindakan berikut memakai data yang sudah tersimpan. Reserved dan
              sold dikelola oleh proses pesanan.
            </p>
            {rights.publish && product.status !== "active" && (
              <button
                className="primary-action"
                disabled={busy || locked}
                onClick={() => void status("publish")}
              >
                Publikasikan
              </button>
            )}
            {rights.publish && product.status !== "draft" && (
              <button
                className="secondary-action"
                disabled={busy || locked}
                onClick={() => void status("draft")}
              >
                Kembalikan ke draft
              </button>
            )}
            {rights.archive && product.status !== "archived" && (
              <button
                className="secondary-action"
                disabled={busy || locked}
                onClick={() => void status("archive")}
              >
                Arsipkan produk
              </button>
            )}
          </section>
        </>
      ) : (
        <p className="small-note">
          Simpan draft dahulu untuk mengunggah foto dan melihat preview.
        </p>
      )}
    </>
  );
}
