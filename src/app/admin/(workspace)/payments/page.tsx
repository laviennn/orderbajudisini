import { Metadata } from "next";
import Link from "next/link";
import { getPaymentQueue } from "@/server/services/admin-payments";
import { requirePermission } from "@/server/auth/authorize";
import { formatIdr } from "@/lib/domain/money";

const formatDateTime = (d: Date) => 
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(d);

export const metadata: Metadata = { title: "Verifikasi Pembayaran" };

export default async function PaymentQueuePage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  await requirePermission("payments.verify");
  
  const statusParam = searchParams.status as "pending" | "submitted" | "verified" | "rejected" | undefined;
  const statusFilter = ["pending", "submitted", "verified", "rejected"].includes(statusParam!) ? statusParam : "submitted";
  
  const page = parseInt(searchParams.page || "1", 10) || 1;
  const data = await getPaymentQueue({ status: statusFilter, page, pageSize: 20 });

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Verifikasi Pembayaran</h1>
      </header>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <Link 
            href="/admin/payments?status=submitted" 
            className={`button ${statusFilter === "submitted" ? "button-primary" : "button-secondary"}`}
          >
            Menunggu Verifikasi
          </Link>
          <Link 
            href="/admin/payments?status=verified" 
            className={`button ${statusFilter === "verified" ? "button-primary" : "button-secondary"}`}
          >
            Terverifikasi
          </Link>
          <Link 
            href="/admin/payments?status=rejected" 
            className={`button ${statusFilter === "rejected" ? "button-primary" : "button-secondary"}`}
          >
            Ditolak
          </Link>
          <Link 
            href="/admin/payments?status=pending" 
            className={`button ${statusFilter === "pending" ? "button-primary" : "button-secondary"}`}
          >
            Menunggu Pembayaran
          </Link>
        </div>

        {data.items.length === 0 ? (
          <p className="empty-state">Tidak ada pembayaran.</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Order</th>
                  <th>Pembeli</th>
                  <th>Jumlah</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.paymentId}>
                    <td>{item.submittedAt ? formatDateTime(item.submittedAt) : '-'}</td>
                    <td><Link href={`/admin/payments/${item.paymentId}`}>{item.orderId.substring(0, 8)}</Link></td>
                    <td>{(() => {
                      try {
                        return (item.addressSnapshot as Record<string, unknown>)?.recipientName as string || '-';
                      } catch {
                        return '-';
                      }
                    })()}</td>
                    <td>{formatIdr(item.expectedAmount || 0)}</td>
                    <td>
                      <span className={`status-badge status-${item.status}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/admin/payments/${item.paymentId}`} className="text-link">
                        Lihat Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {data.totalPages > 1 && (
          <div className="pagination" style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            {data.page > 1 && (
              <Link href={`/admin/payments?status=${statusFilter}&page=${data.page - 1}`} className="text-link">
                &larr; Sebelumnya
              </Link>
            )}
            <span>Halaman {data.page} dari {data.totalPages}</span>
            {data.page < data.totalPages && (
              <Link href={`/admin/payments?status=${statusFilter}&page=${data.page + 1}`} className="text-link">
                Selanjutnya &rarr;
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
