import { listAudit } from "@/server/services/admin-audit";
import { auditLabels } from "@/lib/audit-labels";
import { dateTime } from "@/lib/admin-operations";
import { AdminPagination } from "@/features/admin/Pagination";
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entity?: string; page?: string }>;
}) {
  const data = await listAudit(await searchParams);
  return (
    <main id="main-content">
      <h1>Log audit</h1>
      <p>
        Riwayat tindakan staf dan perubahan operasional. Catatan tidak dapat
        diubah dari panel.
      </p>
      <form className="admin-filters" action="/admin/audit-logs">
        <label>
          Cari staf / tindakan / referensi
          <input name="q" maxLength={80} defaultValue={data.q} />
        </label>
        <label>
          Jenis data
          <select name="entity" defaultValue={data.entity}>
            {[
              ["", "Semua"],
              ["order", "Pesanan"],
              ["payment", "Pembayaran"],
              ["product", "Produk"],
              ["category", "Kategori"],
              ["user", "Staf"],
              ["review", "Ulasan"],
              ["promotion", "Promosi"],
              ["store", "Toko"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-action">Terapkan</button>
      </form>
      <div
        className="admin-table-scroll"
        role="region"
        aria-label="Riwayat audit"
        tabIndex={0}
      >
        <table className="admin-table">
          <thead>
            <tr>
              {[
                "Waktu (WIB)",
                "Staf",
                "Tindakan",
                "Referensi",
                "Perubahan",
              ].map((v) => (
                <th scope="col" key={v}>
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id}>
                <td>{dateTime(row.createdAt)}</td>
                <td>{row.actor ?? "Sistem"}</td>
                <td>{auditLabels[row.action] ?? row.action}</td>
                <td>
                  {row.entityType}
                  <br />
                  {row.entityId}
                </td>
                <td>
                  {typeof row.metadata.from === "string" &&
                  typeof row.metadata.to === "string"
                    ? `${row.metadata.from} → ${row.metadata.to}`
                    : typeof row.metadata.previousQuantity === "number" &&
                        typeof row.metadata.quantity === "number"
                      ? `${row.metadata.previousQuantity} → ${row.metadata.quantity}`
                      : "Tersimpan"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.items.length && (
        <p className="empty-state">Belum ada catatan audit yang sesuai.</p>
      )}
      <AdminPagination
        path="/admin/audit-logs"
        {...data}
        filters={{ q: data.q, entity: data.entity }}
      />
    </main>
  );
}
