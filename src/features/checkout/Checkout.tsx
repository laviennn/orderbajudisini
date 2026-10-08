"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/features/cart/store";
import { formatIdr } from "@/lib/domain/money";
import { trackCommerce } from "@/lib/analytics";
import type { CheckoutPreview } from "@/server/services/checkout";

type CheckoutState = 
  | { status: "editing" }
  | { status: "preparing" }
  | { status: "quotes_ready"; preview: CheckoutPreview; selectedQuoteRef: string }
  | { status: "submitting"; preview: CheckoutPreview; selectedQuoteRef: string };

export function Checkout() {
  const cart = useCart();
  const router = useRouter();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [sameAsBuyer, setSameAsBuyer] = useState(true);
  const [addressLine, setAddressLine] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  
  const [state, setState] = useState<CheckoutState>({ status: "editing" });
  const [error, setError] = useState("");
  const trackedRef = useRef(false);

  useEffect(() => {
    if (cart.ready && cart.ids.length > 0 && !trackedRef.current) {
      trackCommerce("begin_checkout", cart.ids);
      trackedRef.current = true;
    }
  }, [cart.ready, cart.ids]);

  if (!cart.ready) return <p role="status">Memuat keranjang…</p>;
  if (!cart.ids.length) {
    return (
      <div className="empty-state page-width">
        <h2>Keranjang kosong.</h2>
        <p>Anda belum memilih produk untuk dicheckout.</p>
        <Link className="primary-action" href="/products">Kembali belanja</Link>
      </div>
    );
  }

  const handlePrepare = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ status: "preparing" });
    setError("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          data: {
            ids: cart.ids,
            customer: {
              name,
              email: email || null,
              phone,
              recipientName: sameAsBuyer ? name : recipientName,
              addressLine,
              province,
              city,
              district,
              subdistrict: subdistrict || null,
              postalCode,
              notes: notes || undefined,
            }
          }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Gagal mendapatkan ongkos kirim. Periksa kembali alamat Anda.");
      }

      const preview: CheckoutPreview = await res.json();
      
      if (!preview.choices || preview.choices.length === 0) {
        throw new Error("Tidak ada opsi pengiriman tersedia untuk tujuan ini.");
      }
      
      if (preview.payments && preview.payments.length > 0) {
        setPaymentMethodId(preview.payments[0]!.id);
      }
      
      trackCommerce("add_shipping_info", cart.ids);
      setState({ status: "quotes_ready", preview, selectedQuoteRef: preview.choices[0]!.reference });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
      setState({ status: "editing" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.status !== "quotes_ready") return;
    
    setState({ ...state, status: "submitting" });
    setError("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          data: {
            reference: state.selectedQuoteRef,
            paymentMethodId
          }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Gagal membuat pesanan.");
      }

      const result = await res.json();
      cart.removeOrdered(cart.ids);
      trackCommerce("order_created", cart.ids);
      router.push(`/order/${result.publicToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
      setState({ ...state, status: "quotes_ready" });
    }
  };

  return (
    <div className="page-width cart-layout">
      <div>
        <h1>Checkout</h1>
        {error && (
          <div role="alert" style={{ color: "var(--danger)", marginBottom: "1rem" }}>
            <p>{error}</p>
          </div>
        )}
        
        {state.status === "editing" || state.status === "preparing" ? (
          <form className="filter-form" onSubmit={handlePrepare}>
            <h2>Informasi Pemesan</h2>
            <label>
              Nama Lengkap
              <input required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={state.status !== "editing"} />
            </label>
            <label>
              Email (Opsional)
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={state.status !== "editing"} />
            </label>
            <label>
              Nomor WhatsApp / HP
              <input required minLength={8} maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} disabled={state.status !== "editing"} placeholder="08..." />
            </label>

            <h2 style={{ marginTop: "1.5rem" }}>Tujuan Pengiriman</h2>
            <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" checked={sameAsBuyer} onChange={e => setSameAsBuyer(e.target.checked)} disabled={state.status !== "editing"} style={{ width: "auto", minHeight: "auto" }} />
              Sama dengan nama pemesan
            </label>
            {!sameAsBuyer && (
              <label>
                Nama Penerima
                <input required minLength={2} maxLength={120} value={recipientName} onChange={e => setRecipientName(e.target.value)} disabled={state.status !== "editing"} />
              </label>
            )}
            <label>
              Alamat Lengkap
              <input required minLength={5} maxLength={500} value={addressLine} onChange={e => setAddressLine(e.target.value)} disabled={state.status !== "editing"} />
            </label>
            <div className="price-inputs">
              <label>
                Provinsi
                <input required value={province} onChange={e => setProvince(e.target.value)} disabled={state.status !== "editing"} />
              </label>
              <label>
                Kota / Kabupaten
                <input required value={city} onChange={e => setCity(e.target.value)} disabled={state.status !== "editing"} />
              </label>
            </div>
            <div className="price-inputs">
              <label>
                Kecamatan
                <input required value={district} onChange={e => setDistrict(e.target.value)} disabled={state.status !== "editing"} />
              </label>
              <label>
                Kelurahan (Opsional)
                <input value={subdistrict} onChange={e => setSubdistrict(e.target.value)} disabled={state.status !== "editing"} />
              </label>
            </div>
            <label>
              Kode Pos
              <input required pattern="[0-9]{5}" maxLength={5} value={postalCode} onChange={e => setPostalCode(e.target.value)} disabled={state.status !== "editing"} />
            </label>
            <label>
              Catatan Pesanan (Opsional)
              <input maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} disabled={state.status !== "editing"} />
            </label>

            <button type="submit" className="primary-action purchase-action" style={{ marginTop: "1.5rem" }} disabled={state.status !== "editing"}>
              {state.status === "preparing" ? "Memeriksa Ongkir..." : "Pilih Pengiriman"}
            </button>
          </form>
        ) : (
          <form className="filter-form" onSubmit={handleSubmit}>
            <h2>Pilih Layanan Pengiriman</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {state.preview.choices.map((choice) => (
                <label key={choice.reference} style={{ flexDirection: "row", alignItems: "flex-start", gap: "1rem", border: "1px solid var(--border)", padding: "1rem", borderRadius: "var(--radius-control)", cursor: "pointer" }}>
                  <input 
                    type="radio" 
                    name="shippingChoice" 
                    value={choice.reference} 
                    checked={state.selectedQuoteRef === choice.reference} 
                    onChange={() => setState({ ...state, selectedQuoteRef: choice.reference })}
                    disabled={state.status === "submitting"}
                    style={{ width: "auto", minHeight: "auto", marginTop: "4px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0 }}>{choice.courier} - {choice.service}</h3>
                    {choice.estimate && <p className="small-note" style={{ margin: "0.25rem 0 0" }}>Estimasi: {choice.estimate}</p>}
                  </div>
                  <div style={{ fontWeight: 500 }}>
                    {formatIdr(choice.cost)}
                  </div>
                </label>
              ))}
            </div>

            <h2 style={{ marginTop: "2rem" }}>Pilih Metode Pembayaran</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {state.preview.payments?.map((payment: { id: string; name: string; type: string }) => (
                <label key={payment.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: "1rem", border: "1px solid var(--border)", padding: "1rem", borderRadius: "var(--radius-control)", cursor: "pointer" }}>
                  <input 
                    type="radio" 
                    name="paymentChoice" 
                    value={payment.id} 
                    checked={paymentMethodId === payment.id} 
                    onChange={() => setPaymentMethodId(payment.id)}
                    disabled={state.status === "submitting"}
                    style={{ width: "auto", minHeight: "auto", marginTop: "4px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0 }}>{payment.name}</h3>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
              <button type="button" className="text-link" onClick={() => setState({ status: "editing" })} disabled={state.status === "submitting"}>
                Ubah Alamat
              </button>
              <button type="submit" className="primary-action purchase-action" disabled={state.status === "submitting"} style={{ flex: 1 }}>
                {state.status === "submitting" ? "Memproses..." : "Buat Pesanan"}
              </button>
            </div>
          </form>
        )}
      </div>

      <aside className="cart-summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Ringkasan Pesanan</h2>
        {(state.status === "quotes_ready" || state.status === "submitting") ? (() => {
          const choice = state.preview.choices.find(c => c.reference === state.selectedQuoteRef);
          const pricing = state.preview.cart.pricing;
          if (!pricing || !choice) return <p>Data tidak lengkap.</p>;
          return (
            <dl>
              <div>
                <dt>Total produk</dt>
                <dd>{formatIdr(pricing.merchandiseTotal)}</dd>
              </div>
              <div>
                <dt>Ongkos kirim ({choice.courier})</dt>
                <dd>{formatIdr(choice.cost)}</dd>
              </div>
              <div className="cart-total">
                <dt>Total tagihan</dt>
                <dd>{formatIdr(choice.total)}</dd>
              </div>
            </dl>
          );
        })() : (
          <p className="small-note">Isi informasi pengiriman untuk melihat total tagihan beserta ongkos kirim.</p>
        )}
      </aside>
    </div>
  );
}
