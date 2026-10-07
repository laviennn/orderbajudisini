"use client";
import { useEffect, useRef, useState } from "react";
import type { adminProduct } from "@/server/services/admin-products";
import { ProductPhoto } from "@/features/storefront/Interactions";
import { adminRequest, errorText } from "./http";
type Images = Awaited<ReturnType<typeof adminProduct>>["images"];
type Entry = {
  id: string;
  file: File;
  preview: string;
  altText: string;
  defect: boolean;
  state: "queued" | "uploading" | "processing" | "ready" | "error";
  progress: number;
  error?: string;
  uploadId?: string;
  uploaded?: boolean;
};
function uploadBytes(
  file: File,
  url: string,
  headers: Record<string, string>,
  progress: (n: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = 120000;
    for (const [key, value] of Object.entries(headers))
      xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        progress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("Upload failed"));
    xhr.onerror = xhr.ontimeout = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}
export function MediaUploader({
  productId,
  productName,
  initialImages,
  enabled,
  canCleanup,
}: {
  productId: string;
  productName: string;
  initialImages: Images;
  enabled: boolean;
  canCleanup: boolean;
}) {
  const [images, setImages] = useState(initialImages);
  const [queue, setQueue] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => urls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  const base = `/api/admin/products/${productId}/media`;
  const patch = (id: string, update: Partial<Entry>) =>
    setQueue((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...update } : row)),
    );
  function select(files: FileList | File[]) {
    if (!enabled || busy) return;
    const entries: Entry[] = [];
    for (const file of Array.from(files).slice(0, 10)) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 10 * 1024 * 1024 ||
        !file.size
      ) {
        setError("Gunakan JPEG, PNG, atau WebP maksimal 10 MB per file.");
        continue;
      }
      const preview = URL.createObjectURL(file);
      urls.current.push(preview);
      entries.push({
        id: crypto.randomUUID(),
        file,
        preview,
        altText: `${productName} — foto ${images.length + queue.length + entries.length + 1}`,
        defect: false,
        state: "queued",
        progress: 0,
      });
    }
    setQueue((rows) => [...rows, ...entries].slice(0, 10));
  }
  async function reload() {
    const product = await adminRequest<
      Awaited<ReturnType<typeof adminProduct>>
    >(`/api/admin/products/${productId}`);
    setImages(product.images);
  }
  async function run(entries: Entry[]) {
    setBusy(true);
    setError("");
    for (const entry of entries) {
      try {
        let uploadId = entry.uploadId;
        if (!entry.uploaded || !uploadId) {
          patch(entry.id, {
            state: "uploading",
            progress: 0,
            error: undefined,
          });
          const signed = await adminRequest<{
            id: string;
            url: string;
            headers: Record<string, string>;
          }>(`${base}/authorize`, {
            mime: entry.file.type,
            bytes: entry.file.size,
            altText: entry.altText,
            isDefectImage: entry.defect,
          });
          uploadId = signed.id;
          patch(entry.id, { uploadId });
          await uploadBytes(
            entry.file,
            signed.url,
            signed.headers,
            (progress) => patch(entry.id, { progress }),
          );
          patch(entry.id, { uploaded: true });
        }
        patch(entry.id, { state: "processing" });
        await adminRequest(`${base}/complete`, { uploadId });
        patch(entry.id, { state: "ready" });
        await reload();
      } catch (e) {
        patch(entry.id, { state: "error", error: errorText(e) });
      }
    }
    setBusy(false);
  }
  async function mutate(body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await adminRequest<{ cleanup?: { failed: number } }>(
        base,
        body,
      );
      await reload();
      setMessage(
        result.cleanup?.failed
          ? "Foto dilepas. Pembersihan R2 tertunda; gunakan tombol bersihkan untuk mencoba lagi."
          : "Media diperbarui.",
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function cleanup() {
    setBusy(true);
    setError("");
    try {
      const result = await adminRequest<{ failed: number; cleaned: number }>(
        `${base}/cleanup`,
        {},
      );
      setMessage(
        `${result.cleaned} pekerjaan pembersihan selesai; ${result.failed} perlu dicoba lagi. Unggahan tertunda dibersihkan setelah 30 menit.`,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-media" aria-labelledby="media-title">
      <div className="section-heading">
        <h2 id="media-title">Foto produk</h2>
        <button
          className="text-link"
          disabled={busy || !canCleanup}
          onClick={() => void cleanup()}
        >
          Bersihkan unggahan tertunda
        </button>
      </div>
      <p className="small-note">
        JPEG, PNG, WebP · maksimal 10 MB, 24 megapiksel, minimal 100px. Foto
        diproses sekali menjadi tiga ukuran WebP. Foto pertama tanpa penanda
        cacat menjadi foto utama.
      </p>
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div
        className="upload-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          select(e.dataTransfer.files);
        }}
      >
        <label>
          Pilih atau letakkan foto di sini
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={!enabled || busy}
            onChange={(e) => {
              if (e.target.files) select(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {queue.length > 0 && (
        <>
          <ul className="upload-queue">
            {queue.map((entry) => (
              <li key={entry.id}>
                <div className="admin-thumbnail">
                  <ProductPhoto
                    image={{
                      url: entry.preview,
                      alt: entry.altText,
                      width: 320,
                      height: 400,
                      defect: entry.defect,
                    }}
                    sizes="64px"
                  />
                </div>
                <div>
                  <strong>{entry.file.name}</strong>
                  <label>
                    Alt text unggahan
                    <input
                      value={entry.altText}
                      maxLength={300}
                      disabled={busy || Boolean(entry.uploaded)}
                      onChange={(e) =>
                        patch(entry.id, { altText: e.target.value })
                      }
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={entry.defect}
                      disabled={busy || Boolean(entry.uploaded)}
                      onChange={(e) =>
                        patch(entry.id, { defect: e.target.checked })
                      }
                    />
                    Foto cacat
                  </label>
                  <p role="status">
                    {entry.state === "uploading"
                      ? `Mengunggah ${entry.progress}%`
                      : entry.state === "processing"
                        ? "Memvalidasi & membuat varian…"
                        : entry.state === "ready"
                          ? "Foto tersimpan."
                          : entry.state === "error"
                            ? entry.error
                            : "Siap diunggah"}
                  </p>
                  {entry.state === "uploading" && (
                    <progress
                      max={100}
                      value={entry.progress}
                      aria-label={`Unggahan ${entry.file.name}`}
                    />
                  )}
                  {entry.state === "error" && (
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => void run([entry])}
                    >
                      Coba lagi
                    </button>
                  )}
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={() => {
                      URL.revokeObjectURL(entry.preview);
                      setQueue((rows) =>
                        rows.filter((row) => row.id !== entry.id),
                      );
                    }}
                  >
                    Hapus dari antrean
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            className="primary-action"
            disabled={
              busy || !enabled || !queue.some((e) => e.state === "queued")
            }
            onClick={() => void run(queue.filter((e) => e.state === "queued"))}
          >
            {busy ? "Memproses foto…" : "Unggah foto terpilih"}
          </button>
        </>
      )}
      <ol className="media-editor-list">
        {images.map((image, index) => (
          <li key={image.id}>
            <div className="media-preview">
              <ProductPhoto image={image.image} sizes="160px" />
            </div>
            <div>
              <p>
                {index + 1}.{" "}
                {image.isDefectImage
                  ? "Detail cacat"
                  : !images.slice(0, index).some((i) => !i.isDefectImage)
                    ? "Foto utama"
                    : "Foto produk"}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  void mutate({
                    action: "edit",
                    productId,
                    imageId: image.id,
                    altText: String(fd.get("altText")),
                    isDefectImage: fd.get("defect") === "on",
                  });
                }}
              >
                <label>
                  Alt text foto {index + 1}
                  <input
                    name="altText"
                    required
                    maxLength={300}
                    defaultValue={image.altText}
                    disabled={!enabled || busy}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="defect"
                    defaultChecked={image.isDefectImage}
                    disabled={!enabled || busy}
                  />
                  Foto cacat
                </label>
                <button className="text-link" disabled={!enabled || busy}>
                  Simpan keterangan
                </button>
              </form>
              <div className="media-controls">
                {[-1, 1].map((direction) => (
                  <button
                    key={direction}
                    className="secondary-action"
                    disabled={
                      !enabled ||
                      busy ||
                      index + direction < 0 ||
                      index + direction >= images.length
                    }
                    aria-label={`${direction < 0 ? "Naikkan" : "Turunkan"} foto ${index + 1}`}
                    onClick={() => {
                      const ids = images.map((i) => i.id);
                      [ids[index], ids[index + direction]] = [
                        ids[index + direction]!,
                        ids[index]!,
                      ];
                      void mutate({ action: "reorder", productId, ids });
                    }}
                  >
                    {direction < 0 ? "Naik" : "Turun"}
                  </button>
                ))}
                <button
                  className="text-link"
                  disabled={!enabled || busy}
                  onClick={() => {
                    if (window.confirm("Hapus foto beserta semua variannya?"))
                      void mutate({
                        action: "remove",
                        productId,
                        imageId: image.id,
                      });
                  }}
                >
                  Hapus foto {index + 1}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {!images.length && <p>Belum ada foto tersimpan.</p>}
    </section>
  );
}
