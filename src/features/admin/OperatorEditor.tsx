"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, errorText } from "./http";
import { dateTime } from "@/lib/admin-operations";
type Staff = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  status: "active" | "inactive";
  updatedAt: string;
  createdAt: string;
  lastLoginAt: string | null;
};
export function OperatorEditor({
  items,
  roles,
  writable,
  actorId,
}: {
  items: Staff[];
  roles: { id: string; name: string }[];
  writable: boolean;
  actorId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Staff | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>, reset = false) {
    event.preventDefault();
    const form = event.currentTarget,
      fd = new FormData(form);
    const action = reset ? "reset" : selected ? "update" : "create";
    const data = selected
      ? reset
        ? { id: selected.id, password: fd.get("password") }
        : {
            id: selected.id,
            roleId: fd.get("roleId"),
            status: fd.get("status"),
            updatedAt: selected.updatedAt,
          }
      : Object.fromEntries(fd);
    if (
      selected &&
      !window.confirm(
        reset
          ? "Ganti password dan akhiri semua sesi akun ini?"
          : "Simpan perubahan akses dan akhiri sesi lama akun ini?",
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminRequest("/api/admin/operators", { action, ...data });
      if (selected?.id === actorId) {
        router.replace("/admin/login");
        router.refresh();
        return;
      }
      form.reset();
      setSelected(null);
      setMessage(
        reset
          ? "Password diganti. Sampaikan melalui saluran aman kepada staf."
          : "Akun staf tersimpan.",
      );
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div
        className="admin-table-scroll"
        role="region"
        aria-label="Daftar staf"
        tabIndex={0}
      >
        <table className="admin-table">
          <thead>
            <tr>
              {[
                "Staf",
                "Peran",
                "Status",
                "Dibuat",
                "Login terakhir",
                "Tindakan",
              ].map((v) => (
                <th scope="col" key={v}>
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((staff) => (
              <tr key={staff.id}>
                <td>
                  {staff.name}
                  <br />
                  {staff.email}
                </td>
                <td>{staff.roleName}</td>
                <td>{staff.status === "active" ? "Aktif" : "Nonaktif"}</td>
                <td>{dateTime(staff.createdAt)}</td>
                <td>{dateTime(staff.lastLoginAt)}</td>
                <td>
                  {writable && (
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => {
                        setSelected(staff);
                        setError("");
                        setMessage("");
                      }}
                    >
                      Kelola {staff.name}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length && (
        <p className="empty-state">Tidak ada staf yang sesuai.</p>
      )}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {writable && (
        <section className="admin-editor">
          <h2>{selected ? `Akses ${selected.name}` : "Tambah staf"}</h2>
          <p>
            Gunakan password 15–128 karakter. Tidak ada email undangan otomatis.
          </p>
          <form key={selected?.id ?? "new"} onSubmit={(e) => void submit(e)}>
            <fieldset disabled={busy}>
              <div className="editor-grid">
                {!selected && (
                  <>
                    <label>
                      Nama staf
                      <input name="name" required maxLength={120} />
                    </label>
                    <label>
                      Email staf
                      <input
                        type="email"
                        name="email"
                        required
                        maxLength={254}
                      />
                    </label>
                    <label>
                      Password awal
                      <input
                        type="password"
                        name="password"
                        required
                        minLength={15}
                        maxLength={128}
                        autoComplete="new-password"
                      />
                    </label>
                  </>
                )}
                <label>
                  Peran
                  <select
                    name="roleId"
                    required
                    defaultValue={selected?.roleId ?? ""}
                  >
                    <option value="" disabled>
                      Pilih peran
                    </option>
                    {roles.map((role) => (
                      <option value={role.id} key={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                {selected && (
                  <label>
                    Status akun
                    <select name="status" defaultValue={selected.status}>
                      <option value="active">Aktif</option>
                      <option value="inactive">Nonaktif</option>
                    </select>
                  </label>
                )}
              </div>
              <div className="editor-actions">
                <button className="primary-action">
                  {busy ? "Menyimpan…" : "Simpan staf"}
                </button>
                {selected && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setSelected(null)}
                  >
                    Batal / tambah staf
                  </button>
                )}
              </div>
            </fieldset>
          </form>
          {selected && (
            <form
              key={`reset-${selected.id}`}
              onSubmit={(e) => void submit(e, true)}
            >
              <fieldset disabled={busy}>
                <legend>Ganti password</legend>
                <label>
                  Password baru
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={15}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
                <button className="text-link">Ganti password staf</button>
              </fieldset>
            </form>
          )}
        </section>
      )}
    </>
  );
}
