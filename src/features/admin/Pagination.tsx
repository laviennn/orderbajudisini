import Link from "next/link";
export function AdminPagination({
  path,
  page,
  total,
  pageSize = 20,
  filters = {},
}: {
  path: string;
  page: number;
  total: number;
  pageSize?: number;
  filters?: Record<string, string>;
}) {
  const href = (n: number) =>
    `${path}?${new URLSearchParams({ ...filters, page: String(n) })}`;
  return (
    <nav className="pagination" aria-label="Halaman daftar">
      {page > 1 && <Link href={href(page - 1)}>Sebelumnya</Link>}
      <span>
        Halaman {page} · {total} data
      </span>
      {page * pageSize < total && <Link href={href(page + 1)}>Berikutnya</Link>}
    </nav>
  );
}
