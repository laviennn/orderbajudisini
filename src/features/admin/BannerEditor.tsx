"use client";
import { useState } from "react";
import { adminRequest, errorText } from "./http";
import { SiteImageInput } from "./SiteImageInput";
type Banner = {
  id?: string;
  internalName: string;
  headline: string | null;
  body: string | null;
  imageObjectKey: string | null;
  mobileImageObjectKey: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  active: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  imageUrl?: string | null;
  mobileUrl?: string | null;
};
const empty: Banner = {
  internalName: "",
  headline: null,
  body: null,
  imageObjectKey: null,
  mobileImageObjectKey: null,
  ctaLabel: null,
  ctaUrl: null,
  active: false,
  sortOrder: 0,
  startsAt: null,
  endsAt: null,
};
export function BannerEditor({
  initial,
  editable,
}: {
  initial: Banner[];
  editable: boolean;
}) {
  const [rows, setRows] = useState(initial);
  const [value, setValue] = useState<Banner>(empty);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    const rows = await adminRequest<Banner[]>("/api/admin/banners");
    setRows(rows);
  }
  const local = (v: string | null) =>
    v
      ? new Date(
          new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
  return (
    <div>
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Banner</th>
              <th>Urutan</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.internalName}</td>
                <td>{row.sortOrder}</td>
                <td>{row.active ? "Aktif sesuai jadwal" : "Nonaktif"}</td>
                <td>
                  <button
                    disabled={busy || uploading}
                    onClick={() => {
                      setValue(row);
                      setMessage("");
                    }}
                  >
                    Edit
                  </button>
                  {editable && (
                    <button
                      disabled={busy || uploading}
                      onClick={async () => {
                        if (!confirm(`Hapus banner ${row.internalName}?`))
                          return;
                        setBusy(true);
                        try {
                          await adminRequest("/api/admin/banners", {
                            action: "delete",
                            data: { id: row.id },
                          });
                          await refresh();
                          if (value.id === row.id) setValue(empty);
                          setMessage("Banner dihapus.");
                        } catch (error) {
                          setMessage(errorText(error));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Hapus
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>Belum ada banner.</p>}
      <button disabled={busy || uploading} onClick={() => setValue(empty)}>
        Banner baru
      </button>
      <form
        className="admin-editor"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const { imageUrl: _image, mobileUrl: _mobile, ...data } = value;
            void _image;
            void _mobile;
            await adminRequest("/api/admin/banners", { action: "save", data });
            await refresh();
            setValue(empty);
            setMessage("Banner disimpan.");
          } catch (error) {
            setMessage(errorText(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={!editable || busy || uploading}>
          <legend>{value.id ? "Edit banner" : "Banner baru"}</legend>
          {(
            [
              ["internalName", "Nama internal"],
              ["headline", "Judul"],
              ["body", "Teks"],
              ["ctaLabel", "Label tautan"],
              ["ctaUrl", "Tujuan tautan (/products)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required={key === "internalName"}
                value={value[key] ?? ""}
                onChange={(e) =>
                  setValue({
                    ...value,
                    [key]:
                      e.target.value || (key === "internalName" ? "" : null),
                  })
                }
              />
            </label>
          ))}
          <SiteImageInput
            label="Gambar desktop"
            value={value.imageObjectKey}
            url={value.imageUrl}
            scope="banner"
            onBusy={setUploading}
            onChange={(key, url) =>
              setValue((v) => ({ ...v, imageObjectKey: key, imageUrl: url }))
            }
          />
          <SiteImageInput
            label="Gambar mobile"
            value={value.mobileImageObjectKey}
            url={value.mobileUrl}
            scope="banner"
            onBusy={setUploading}
            onChange={(key, url) =>
              setValue((v) => ({
                ...v,
                mobileImageObjectKey: key,
                mobileUrl: url,
              }))
            }
          />
          <label>
            Urutan (terkecil tampil dahulu)
            <input
              type="number"
              min="0"
              max="10000"
              value={value.sortOrder}
              onChange={(e) =>
                setValue({ ...value, sortOrder: Number(e.target.value) })
              }
            />
          </label>
          {(["startsAt", "endsAt"] as const).map((key) => (
            <label key={key}>
              {key === "startsAt" ? "Mulai" : "Berakhir"} (waktu lokal browser)
              <input
                type="datetime-local"
                value={local(value[key])}
                onChange={(e) =>
                  setValue({
                    ...value,
                    [key]: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
              />
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={value.active}
              onChange={(e) => setValue({ ...value, active: e.target.checked })}
            />
            Aktif
          </label>
          <p>
            Beranda menampilkan banner aktif dengan urutan terkecil yang sedang
            berada dalam jadwal. Perubahan jadwal terlihat paling lambat satu
            menit.
          </p>
          <button className="primary-action">
            {busy ? "Menyimpan…" : "Simpan banner"}
          </button>
        </fieldset>
      </form>
      <p role="status">{message}</p>
    </div>
  );
}
