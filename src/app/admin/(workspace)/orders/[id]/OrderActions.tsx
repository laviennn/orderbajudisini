"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderActions({
  orderId,
  status,
  defaultCourier,
  defaultService,
}: {
  orderId: string;
  status: string;
  defaultCourier: string;
  defaultService: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showShipForm, setShowShipForm] = useState(false);
  const [shipData, setShipData] = useState({
    courier: defaultCourier,
    service: defaultService,
    trackingNumber: "",
    shippedAt: new Date().toISOString().substring(0, 16),
  });

  const handleAction = async (action: "process" | "complete") => {
    if (!confirm(`Are you sure you want to ${action} this order?`)) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/${action}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      alert(`Failed to ${action} order: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipData.trackingNumber.trim()) {
      alert("Nomor resi wajib diisi");
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/ship`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...shipData,
          shippedAt: new Date(shipData.shippedAt).toISOString(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowShipForm(false);
      router.refresh();
    } catch (err) {
      alert(`Failed to ship order: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {status === "payment_verified" && (
        <button
          className="btn btn-primary"
          onClick={() => handleAction("process")}
          disabled={isLoading}
        >
          Proses Pesanan
        </button>
      )}

      {status === "processing" && (
        <>
          <button
            className="btn btn-primary"
            onClick={() => setShowShipForm(!showShipForm)}
            disabled={isLoading}
          >
            Kirim Pesanan
          </button>
          
          {showShipForm && (
            <form onSubmit={handleShip} className="card" style={{ marginTop: '1rem', border: '1px solid #ccc' }}>
              <h3>Detail Pengiriman</h3>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Kurir</label>
                <input 
                  type="text" 
                  value={shipData.courier}
                  onChange={(e) => setShipData({...shipData, courier: e.target.value})}
                  required
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Layanan</label>
                <input 
                  type="text" 
                  value={shipData.service}
                  onChange={(e) => setShipData({...shipData, service: e.target.value})}
                  required
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Nomor Resi (Tracking Number)</label>
                <input 
                  type="text" 
                  value={shipData.trackingNumber}
                  onChange={(e) => setShipData({...shipData, trackingNumber: e.target.value})}
                  required
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Waktu Pengiriman</label>
                <input 
                  type="datetime-local" 
                  value={shipData.shippedAt}
                  onChange={(e) => setShipData({...shipData, shippedAt: e.target.value})}
                  required
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  Simpan & Kirim
                </button>
                <button type="button" className="btn" onClick={() => setShowShipForm(false)} disabled={isLoading}>
                  Batal
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {status === "shipped" && (
        <button
          className="btn btn-primary"
          onClick={() => handleAction("complete")}
          disabled={isLoading}
        >
          Selesaikan Pesanan
        </button>
      )}
    </div>
  );
}
