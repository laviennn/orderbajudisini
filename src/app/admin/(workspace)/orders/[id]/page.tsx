import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminOrderDetail } from "@/server/services/admin-orders";
import { requirePermission } from "@/server/auth/authorize";
import { hasPermission } from "@/server/auth/policy";
import { AppError } from "@/lib/errors";
import { orderLabels, paymentLabels, dateTime } from "@/lib/admin-operations";
import { formatIdr } from "@/lib/domain/money";
import OrderActions from "./OrderActions";
export default async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePermission("orders.read");
  const { id } = await params;
  let data;
  try {
    data = await getAdminOrderDetail(id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { order, orderItems, shipment, payment, history, customer } = data;
  const address = order.addressSnapshot;
  return (
    <main id="main-content">
      <Link className="text-link" href="/admin/orders">
        Kembali ke pesanan
      </Link>
      <h1>Pesanan {order.orderNumber}</h1>
      <p>
        {orderLabels[order.status]} · {dateTime(order.createdAt)} WIB
      </p>
      <div className="admin-detail-grid">
        <section>
          <h2>Pembeli dan penerima</h2>
          <p>
            {customer?.name} · {customer?.phone}
          </p>
          {customer?.email && <p>{customer.email}</p>}
          <address>
            {address.recipientName}
            <br />
            {address.phone}
            <br />
            {address.addressLine}
            <br />
            {[
              address.subdistrict,
              address.district,
              address.city,
              address.province,
              address.postalCode,
            ]
              .filter(Boolean)
              .join(", ")}
          </address>
          {order.notes && <p>Catatan pembeli: {order.notes}</p>}
        </section>
        <section>
          <h2>Pembayaran dan pengiriman</h2>
          <dl className="property-list">
            <div>
              <dt>Pembayaran</dt>
              <dd>
                {payment ? paymentLabels[payment.status] : "Belum tersedia"}
              </dd>
            </div>
            <div>
              <dt>Batas pembayaran</dt>
              <dd>{dateTime(order.paymentDueAt)} WIB</dd>
            </div>
            <div>
              <dt>Kurir / layanan</dt>
              <dd>
                {shipment?.courier ?? order.shippingCourier} /{" "}
                {shipment?.service ?? order.shippingService}
              </dd>
            </div>
            <div>
              <dt>Nomor resi</dt>
              <dd>{shipment?.trackingNumber ?? "Belum dikirim"}</dd>
            </div>
            <div>
              <dt>Dikirim</dt>
              <dd>{dateTime(shipment?.shippedAt ?? null)}</dd>
            </div>
            <div>
              <dt>Diterima</dt>
              <dd>{dateTime(shipment?.deliveredAt ?? null)}</dd>
            </div>
          </dl>
          {payment && hasPermission(actor, "payments.read") && (
            <Link className="text-link" href={`/admin/payments/${payment.id}`}>
              Detail pembayaran
            </Link>
          )}
          {payment?.rejectionReason && (
            <p>Alasan penolakan: {payment.rejectionReason}</p>
          )}
        </section>
      </div>
      <h2>Rincian pesanan</h2>
      <div
        className="admin-table-scroll"
        role="region"
        aria-label="Produk pesanan"
        tabIndex={0}
      >
        <table className="admin-table">
          <thead>
            <tr>
              {[
                "Produk / SKU",
                "Ukuran / kondisi",
                "Jumlah",
                "Harga",
                "Total",
              ].map((v) => (
                <th scope="col" key={v}>
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderItems.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.nameSnapshot}
                  <br />
                  {item.skuSnapshot}
                </td>
                <td>
                  {item.sizeSnapshot} · {item.conditionSnapshot}
                </td>
                <td>{item.quantity}</td>
                <td>{formatIdr(item.priceSnapshot)}</td>
                <td>{formatIdr(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="property-list">
        <div>
          <dt>Subtotal awal</dt>
          <dd>{formatIdr(order.subtotal)}</dd>
        </div>
        <div>
          <dt>Diskon</dt>
          <dd>{formatIdr(order.discountTotal)}</dd>
        </div>
        <div>
          <dt>Total produk</dt>
          <dd>{formatIdr(order.merchandiseTotal)}</dd>
        </div>
        <div>
          <dt>Ongkir</dt>
          <dd>{formatIdr(order.shippingCost)}</dd>
        </div>
        <div>
          <dt>Total pesanan</dt>
          <dd>{formatIdr(order.grandTotal)}</dd>
        </div>
      </dl>
      <OrderActions
        orderId={id}
        status={order.status}
        defaultCourier={shipment?.courier ?? order.shippingCourier}
        defaultService={shipment?.service ?? order.shippingService}
        trackingNumber={shipment?.trackingNumber ?? null}
        canUpdate={hasPermission(actor, "orders.update")}
        canShip={hasPermission(actor, "shipments.update")}
      />
      <h2>Riwayat status</h2>
      <ol className="admin-recent">
        {history.map((row) => (
          <li key={row.id}>
            <span>
              {dateTime(row.createdAt)} WIB · {orderLabels[row.to]}
              <br />
              {row.actor ?? "Sistem"}
              {row.note ? ` · ${row.note}` : ""}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
