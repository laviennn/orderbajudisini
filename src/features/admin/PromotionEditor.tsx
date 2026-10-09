"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, errorText } from "./http";
import { formatIdr } from "@/lib/domain/money";
import type { PricingResult } from "@/lib/domain/pricing";
type Target = { id: string; name: string; sku: string };
export type Campaign = {
  id: string;
  name: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  categoryId: string | null;
  allocationStrategy: string | null;
  updatedAt: string;
  targets: Target[];
};
type Product = Target & {
  status: string;
  promotionEligible: boolean;
  price: number;
};
const localDate = (value: string | null) =>
  value
    ? new Date(
        new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
export function PromotionEditor({
  items,
  categories,
  writable,
}: {
  items: Campaign[];
  categories: { id: string; name: string }[];
  writable: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Campaign | null>(null),
    [targets, setTargets] = useState<Target[]>([]),
    [sample, setSample] = useState<Target[]>([]),
    [results, setResults] = useState<Product[]>([]),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [hasNext, setHasNext] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState<PricingResult | null>(null);
  async function perform(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function search(nextPage = 1) {
    const data = await adminRequest<{ items: Product[]; hasNext: boolean }>(
      "/api/admin/promotions",
      { action: "search", data: { q: query, page: nextPage, pageSize: 10 } },
    );
    setResults(data.items);
    setPage(nextPage);
    setHasNext(data.hasNext);
  }
  function edit(campaign: Campaign | null) {
    setSelected(campaign);
    setTargets(campaign?.targets ?? []);
    setError("");
    setMessage("");
    setPreview(null);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      fd = new FormData(form);
    if (
      !window.confirm(
        "Simpan konfigurasi promosi ini? Harga checkout berikutnya akan mengikuti konfigurasi tersimpan.",
      )
    )
      return;
    await perform(async () => {
      const date = (key: string) =>
        fd.get(key) ? new Date(String(fd.get(key))).toISOString() : null;
      await adminRequest("/api/admin/promotions", {
        action: "save",
        data: {
          ...(selected
            ? { id: selected.id, updatedAt: selected.updatedAt }
            : {}),
          name: fd.get("name"),
          active: fd.get("active") === "on",
          requiredQuantity: 3,
          bundlePrice: 100000,
          pricePolicy: "discount_only",
          allocationStrategy: fd.get("allocationStrategy") || null,
          priority: Number(fd.get("priority")),
          categoryId: fd.get("categoryId") || null,
          startsAt: date("startsAt"),
          endsAt: date("endsAt"),
          productIds: targets.map((p) => p.id),
        },
      });
      edit(null);
      form.reset();
      setMessage(
        "Promosi tersimpan. Jalankan simulasi untuk memeriksa harga terbaru.",
      );
      router.refresh();
    });
  }
  const toggle = (values: Target[], product: Target) =>
    values.some((p) => p.id === product.id)
      ? values.filter((p) => p.id !== product.id)
      : [...values, product];
  return (
    <>
      <div
        className="admin-table-scroll"
        role="region"
        aria-label="Daftar promosi"
        tabIndex={0}
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>Promosi</th>
              <th>Status</th>
              <th>Prioritas</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.active ? "Aktif (mengikuti jadwal)" : "Nonaktif"}</td>
                <td>{p.priority}</td>
                <td>
                  <button className="text-link" onClick={() => edit(p)}>
                    {writable ? "Kelola" : "Lihat"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length && <p>Belum ada promosi.</p>}
      <form
        key={selected?.id ?? "new"}
        className="admin-editor"
        onSubmit={save}
      >
        <h2>{selected ? `Promosi: ${selected.name}` : "Buat promosi"}</h2>
        <p>
          3 produk eligible, maksimum Rp100.000 per bundle. Harga yang lebih
          murah tetap berlaku. Promosi tidak ditumpuk; prioritas lebih tinggi
          diproses lebih dahulu.
        </p>
        <fieldset disabled={!writable || busy}>
          <legend>Konfigurasi promosi</legend>
          <div className="editor-grid">
            <label>
              Nama promosi
              <input
                name="name"
                required
                maxLength={200}
                defaultValue={selected?.name ?? ""}
              />
            </label>
            <label>
              Prioritas
              <input
                name="priority"
                type="number"
                min={0}
                max={1000}
                required
                defaultValue={selected?.priority ?? 0}
              />
            </label>
            <label>
              Alokasi produk
              <select
                name="allocationStrategy"
                required
                defaultValue={selected?.allocationStrategy ?? ""}
              >
                <option value="">Pilih urutan</option>
                <option value="highest_price_first">
                  Harga tertinggi dahulu
                </option>
                <option value="lowest_price_first">
                  Harga terendah dahulu
                </option>
              </select>
            </label>
            <label>
              Kategori
              <select
                name="categoryId"
                defaultValue={selected?.categoryId ?? ""}
              >
                <option value="">Semua kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mulai (waktu perangkat)
              <input
                name="startsAt"
                type="datetime-local"
                defaultValue={localDate(selected?.startsAt ?? null)}
              />
            </label>
            <label>
              Berakhir (waktu perangkat)
              <input
                name="endsAt"
                type="datetime-local"
                defaultValue={localDate(selected?.endsAt ?? null)}
              />
            </label>
          </div>
          <label>
            <input
              type="checkbox"
              name="active"
              defaultChecked={selected?.active ?? false}
            />{" "}
            Aktifkan promosi
          </label>
          <p>
            Jadwal kosong berarti tanpa batas waktu. Target kosong berlaku untuk
            semua produk eligible dalam kategori pilihan. Target tidak otomatis
            membuat produk eligible.
          </p>
          <ul>
            {targets.map((p) => (
              <li key={p.id}>
                {p.name} · {p.sku}{" "}
                <button
                  type="button"
                  onClick={() =>
                    setTargets(targets.filter((t) => t.id !== p.id))
                  }
                >
                  Hapus target {p.sku}
                </button>
              </li>
            ))}
          </ul>
          <button className="primary-action">Simpan promosi</button>
        </fieldset>
        {selected && (
          <button
            type="button"
            className="text-link"
            onClick={() => edit(null)}
          >
            Buat promosi baru
          </button>
        )}
      </form>
      <section className="admin-editor" aria-labelledby="promotion-products">
        <h2 id="promotion-products">Produk & simulasi harga</h2>
        <p>
          Pilih target promosi di atas atau sampel simulasi di bawah. Simulasi
          memakai harga, eligibility, jadwal, dan seluruh promosi yang sudah
          tersimpan saat ini, satu unit per produk; tidak membuat reservasi.
        </p>
        <form
          className="admin-filters"
          onSubmit={(e) => {
            e.preventDefault();
            void perform(() => search());
          }}
        >
          <label>
            Cari produk untuk promosi
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={80}
            />
          </label>
          <button disabled={busy}>Cari produk</button>
        </form>
        <ul className="admin-review-list">
          {results.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong> · {p.sku} · {formatIdr(p.price)} ·{" "}
              {p.status}
              <div className="editor-actions">
                {writable && (
                  <label>
                    <input
                      type="checkbox"
                      checked={targets.some((t) => t.id === p.id)}
                      onChange={() => setTargets(toggle(targets, p))}
                    />{" "}
                    Target {p.sku}
                  </label>
                )}
                <label>
                  <input
                    type="checkbox"
                    disabled={p.status !== "active"}
                    checked={sample.some((t) => t.id === p.id)}
                    onChange={() => {
                      setSample(toggle(sample, p));
                      setPreview(null);
                    }}
                  />{" "}
                  Simulasi {p.sku}
                </label>
                <span>
                  {p.promotionEligible ? "Eligible" : "Tidak eligible"}
                </span>
                {writable && !["sold", "reserved"].includes(p.status) && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Ubah eligibility ${p.sku}?`))
                        void perform(async () => {
                          await adminRequest("/api/admin/promotions", {
                            action: "eligibility",
                            data: {
                              productId: p.id,
                              eligible: !p.promotionEligible,
                            },
                          });
                          setPreview(null);
                          await search(page);
                          setMessage("Eligibility tersimpan.");
                          router.refresh();
                        });
                    }}
                  >
                    Ubah eligibility {p.sku}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!results.length && <p>Cari produk berdasarkan nama atau SKU.</p>}
        <div className="editor-actions">
          {page > 1 && (
            <button
              disabled={busy}
              onClick={() => void perform(() => search(page - 1))}
            >
              Produk sebelumnya
            </button>
          )}
          {hasNext && (
            <button
              disabled={busy}
              onClick={() => void perform(() => search(page + 1))}
            >
              Produk berikutnya
            </button>
          )}
        </div>
        <p>
          Sampel:{" "}
          {sample.length
            ? sample.map((p) => p.sku).join(", ")
            : "belum dipilih"}
        </p>
        <button
          className="primary-action"
          disabled={busy || !sample.length}
          onClick={() =>
            void perform(async () =>
              setPreview(
                await adminRequest<PricingResult>("/api/admin/promotions", {
                  action: "preview",
                  data: { productIds: sample.map((p) => p.id) },
                }),
              ),
            )
          }
        >
          Simulasikan harga tersimpan
        </button>
        {preview && (
          <div role="status">
            <dl className="property-list">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatIdr(preview.originalSubtotal)}</dd>
              </div>
              <div>
                <dt>Diskon</dt>
                <dd>{formatIdr(preview.promotionDiscount)}</dd>
              </div>
              <div>
                <dt>Total barang</dt>
                <dd>{formatIdr(preview.merchandiseTotal)}</dd>
              </div>
            </dl>
            <p>
              Promosi diterapkan:{" "}
              {preview.appliedPromotions.map((p) => p.name).join(", ") ||
                "tidak ada"}
            </p>
          </div>
        )}
      </section>
      {busy && <p role="status">Memproses…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </>
  );
}
