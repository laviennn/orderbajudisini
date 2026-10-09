import { operatorDirectory } from "@/server/services/operators";
import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import { OperatorEditor } from "@/features/admin/OperatorEditor";
import { AdminPagination } from "@/features/admin/Pagination";
export default async function Operators({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const actor = await requirePermission("operators.read");
  const data = await operatorDirectory(await searchParams);
  return (
    <main id="main-content">
      <h1>Staf dan akses</h1>
      <form action="/admin/operators" className="admin-filters">
        <label>
          Cari staf
          <input name="q" maxLength={80} defaultValue={data.q} />
        </label>
        <label>
          Status akun
          <select name="status" defaultValue={data.status}>
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </label>
        <button className="primary-action">Terapkan</button>
      </form>
      <OperatorEditor
        actorId={actor.id}
        writable={hasPermission(actor, "operators.manage")}
        roles={data.roles}
        items={data.items.map((item) => ({
          ...item,
          updatedAt: item.updatedAt.toISOString(),
          createdAt: item.createdAt.toISOString(),
          lastLoginAt: item.lastLoginAt?.toISOString() ?? null,
        }))}
      />
      <AdminPagination
        path="/admin/operators"
        {...data}
        filters={{ q: data.q, status: data.status }}
      />
    </main>
  );
}
