"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/features/cart/store";
import { formatIdr } from "@/lib/domain/money";
import { trackCommerce } from "@/lib/analytics";
import type {
  CheckoutPreview,
  PaymentMethodChoice,
} from "@/server/services/checkout";
import { ShippingIcon, BankIcon, AlertCircleIcon } from "./Icons";
import { CopyButton } from "./CopyButton";

type CheckoutState =
  | { status: "editing" }
  | { status: "preparing" }
  | {
      status: "quotes_ready";
      preview: CheckoutPreview;
      selectedQuoteRef: string;
    }
  | {
      status: "submitting";
      preview: CheckoutPreview;
      selectedQuoteRef: string;
    };

function formatApiError(
  err: { message?: string; fieldErrors?: Record<string, string[]> },
  fallback: string,
): string {
  if (err.fieldErrors && typeof err.fieldErrors === "object") {
    const entries = Object.entries(err.fieldErrors);
    const first = entries[0];
    if (first) {
      const [field, msgs] = first;
      const msg = Array.isArray(msgs) ? msgs[0] : msgs;
      const fieldLabels: Record<string, string> = {
        "customer.name": "Nama Lengkap",
        "customer.phone": "Nomor WhatsApp",
        phone: "Nomor WhatsApp",
        "customer.recipientName": "Nama Penerima",
        "customer.addressLine": "Alamat Lengkap",
        "customer.province": "Provinsi",
        "customer.city": "Kota / Kabupaten",
        "customer.district": "Kecamatan",
        "customer.subdistrict": "Kelurahan",
        "customer.postalCode": "Kode Pos",
        "customer.email": "Email",
        ids: "Item Keranjang",
      };
      const label = fieldLabels[field] || field;
      return `${label}: ${msg}`;
    }
  }
  return err.message || fallback;
}

function ErrorAlert({ message, id }: { message: string; id?: string }) {
  return (
    <div
      id={id}
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        padding: "0.875rem 1rem",
        borderRadius: "var(--radius-control)",
        backgroundColor: "#fff1f2",
        border: "1.5px solid #fecdd3",
        color: "#9f1239",
        fontSize: "0.875rem",
        lineHeight: 1.5,
        margin: "1rem 0",
        boxShadow: "0 2px 6px rgba(225, 29, 72, 0.08)",
      }}
    >
      <AlertCircleIcon
        size={20}
        style={{ color: "#e11d48", flexShrink: 0, marginTop: "2px" }}
      />
      <div style={{ flex: 1 }}>
        <strong
          style={{
            display: "block",
            color: "#be123c",
            marginBottom: "0.125rem",
            fontSize: "0.875rem",
            fontWeight: 700,
          }}
        >
          Periksa Data Anda
        </strong>
        <span>{message}</span>
      </div>
    </div>
  );
}

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
  const [isSubmitted, setIsSubmitted] = useState(false);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (cart.ready && cart.ids.length > 0 && !trackedRef.current) {
      trackCommerce("begin_checkout", cart.ids);
      trackedRef.current = true;
    }
  }, [cart.ready, cart.ids]);

  useEffect(() => {
    if (error) {
      const isQuotesReady =
        state.status === "quotes_ready" || state.status === "submitting";
      const targetId = isQuotesReady
        ? "checkout-submit-error"
        : "checkout-prepare-error";
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [error, state.status]);

  if (isSubmitted) {
    return (
      <div
        className="section-space page-width"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "360px",
          textAlign: "center",
          padding: "3rem 1rem",
        }}
      >
        <div
          className="animate-spin"
          style={{
            width: "44px",
            height: "44px",
            border: "3px solid var(--border, #d4d5cc)",
            borderTopColor: "var(--primary, #354a37)",
            borderRadius: "50%",
            marginBottom: "1.25rem",
          }}
        />
        <h2
          style={{
            fontFamily: "var(--font-display, Georgia, serif)",
            fontSize: "1.5rem",
            color: "var(--foreground, #242922)",
            margin: "0 0 0.5rem",
          }}
        >
          Pesanan Berhasil Dibuat
        </h2>
        <p
          style={{
            color: "var(--muted-foreground, #62675c)",
            fontSize: "0.95rem",
            maxWidth: "420px",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Sedang menyiapkan rincian pembayaran untuk pesanan Anda…
        </p>
      </div>
    );
  }

  if (!cart.ready) return <p role="status">Memuat keranjang…</p>;
  if (!cart.ids.length && !isSubmitted) {
    return (
      <div className="empty-state page-width">
        <h2>Keranjang kosong.</h2>
        <p>Anda belum memilih produk untuk dicheckout.</p>
        <Link className="primary-action" href="/products">
          Kembali belanja
        </Link>
      </div>
    );
  }

  const handlePrepare = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ status: "preparing" });
    setError("");

    try {
      const trimmedCustomer = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim(),
        recipientName: (sameAsBuyer ? name : recipientName).trim(),
        addressLine: addressLine.trim(),
        province: province.trim(),
        city: city.trim(),
        district: district.trim(),
        subdistrict: subdistrict.trim() || null,
        postalCode: postalCode.trim(),
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          data: {
            ids: cart.ids,
            customer: trimmedCustomer,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          formatApiError(
            err,
            "Gagal mendapatkan ongkos kirim. Periksa kembali alamat Anda.",
          ),
        );
      }

      const preview: CheckoutPreview = await res.json();

      if (!preview.choices || preview.choices.length === 0) {
        throw new Error("Tidak ada opsi pengiriman tersedia untuk tujuan ini.");
      }

      if (preview.payments && preview.payments.length > 0) {
        setPaymentMethodId(preview.payments[0]!.id);
      }

      trackCommerce("add_shipping_info", cart.ids);
      setState({
        status: "quotes_ready",
        preview,
        selectedQuoteRef: preview.choices[0]!.reference,
      });
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
            paymentMethodId,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(formatApiError(err, "Gagal membuat pesanan."));
      }

      const result = await res.json();
      setIsSubmitted(true);
      cart.removeOrdered(cart.ids);
      trackCommerce("order_created", cart.ids);
      router.push(`/order/${result.publicToken}`);
    } catch (err) {
      setIsSubmitted(false);
      setError(err instanceof Error ? err.message : "Gagal");
      setState({ ...state, status: "quotes_ready" });
    }
  };

  return (
    <div className="page-width cart-layout">
      <div>
        <h1 style={{ marginBottom: "1.25rem" }}>Checkout</h1>

        {/* Step Indicator */}
        <div className="checkout-steps-bar" aria-label="Tahapan Checkout">
          <div
            className={`checkout-step-item ${
              state.status === "editing" || state.status === "preparing"
                ? "is-active"
                : "is-complete"
            }`}
          >
            <span className="checkout-step-num">
              {state.status === "quotes_ready" || state.status === "submitting"
                ? "✓"
                : "1"}
            </span>
            <span className="checkout-step-text">Data Pengiriman</span>
          </div>
          <div className="checkout-step-divider" aria-hidden="true" />
          <div
            className={`checkout-step-item ${
              state.status === "quotes_ready" || state.status === "submitting"
                ? "is-active"
                : ""
            }`}
          >
            <span className="checkout-step-num">2</span>
            <span className="checkout-step-text">Pengiriman & Pembayaran</span>
          </div>
        </div>

        {error && <ErrorAlert message={error} id="checkout-top-error" />}

        {state.status === "editing" || state.status === "preparing" ? (
          <form className="checkout-form" onSubmit={handlePrepare}>
            <div className="checkout-form-section">
              <h2 className="checkout-form-title">
                <span className="checkout-step-badge">1</span>
                Informasi Pemesan
              </h2>
              <div className="checkout-field">
                <label className="checkout-label" htmlFor="checkout-name">
                  Nama Lengkap *
                </label>
                <input
                  id="checkout-name"
                  className="checkout-input"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={state.status !== "editing"}
                  placeholder="Nama lengkap Anda"
                />
              </div>
              <div className="checkout-field">
                <label className="checkout-label" htmlFor="checkout-email">
                  Email (Opsional)
                </label>
                <input
                  id="checkout-email"
                  className="checkout-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={state.status !== "editing"}
                  placeholder="email@contoh.com"
                />
              </div>
              <div className="checkout-field">
                <label className="checkout-label" htmlFor="checkout-phone">
                  Nomor WhatsApp / HP *
                </label>
                <input
                  id="checkout-phone"
                  className="checkout-input"
                  required
                  minLength={8}
                  maxLength={30}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={state.status !== "editing"}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>

            <div
              className="checkout-form-section"
              style={{ marginTop: "0.5rem" }}
            >
              <h2 className="checkout-form-title">
                <span className="checkout-step-badge">2</span>
                Tujuan Pengiriman
              </h2>
              <label className="checkout-checkbox-label">
                <input
                  type="checkbox"
                  checked={sameAsBuyer}
                  onChange={(e) => setSameAsBuyer(e.target.checked)}
                  disabled={state.status !== "editing"}
                  className="checkout-checkbox"
                />
                <span>Sama dengan nama pemesan</span>
              </label>
              {!sameAsBuyer && (
                <div className="checkout-field">
                  <label
                    className="checkout-label"
                    htmlFor="checkout-recipient"
                  >
                    Nama Penerima *
                  </label>
                  <input
                    id="checkout-recipient"
                    className="checkout-input"
                    required
                    minLength={2}
                    maxLength={120}
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    disabled={state.status !== "editing"}
                    placeholder="Nama penerima paket"
                  />
                </div>
              )}
              <div className="checkout-field">
                <label className="checkout-label" htmlFor="checkout-address">
                  Alamat Lengkap *
                </label>
                <input
                  id="checkout-address"
                  className="checkout-input"
                  required
                  minLength={5}
                  maxLength={500}
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  disabled={state.status !== "editing"}
                  placeholder="Nama jalan, nomor rumah, RT/RW, patokan"
                />
              </div>
              <div className="checkout-grid-2">
                <div className="checkout-field">
                  <label className="checkout-label" htmlFor="checkout-province">
                    Provinsi *
                  </label>
                  <input
                    id="checkout-province"
                    className="checkout-input"
                    required
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    disabled={state.status !== "editing"}
                    placeholder="Contoh: DKI Jakarta"
                  />
                </div>
                <div className="checkout-field">
                  <label className="checkout-label" htmlFor="checkout-city">
                    Kota / Kabupaten *
                  </label>
                  <input
                    id="checkout-city"
                    className="checkout-input"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={state.status !== "editing"}
                    placeholder="Contoh: Jakarta Selatan"
                  />
                </div>
              </div>
              <div className="checkout-grid-2">
                <div className="checkout-field">
                  <label className="checkout-label" htmlFor="checkout-district">
                    Kecamatan *
                  </label>
                  <input
                    id="checkout-district"
                    className="checkout-input"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    disabled={state.status !== "editing"}
                    placeholder="Contoh: Tebet"
                  />
                </div>
                <div className="checkout-field">
                  <label
                    className="checkout-label"
                    htmlFor="checkout-subdistrict"
                  >
                    Kelurahan (Opsional)
                  </label>
                  <input
                    id="checkout-subdistrict"
                    className="checkout-input"
                    value={subdistrict}
                    onChange={(e) => setSubdistrict(e.target.value)}
                    disabled={state.status !== "editing"}
                    placeholder="Contoh: Tebet Timur"
                  />
                </div>
              </div>
              <div className="checkout-field">
                <label className="checkout-label" htmlFor="checkout-postal">
                  Kode Pos *
                </label>
                <input
                  id="checkout-postal"
                  className="checkout-input"
                  required
                  pattern="[0-9]{5}"
                  maxLength={5}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  disabled={state.status !== "editing"}
                  placeholder="Contoh: 12820"
                />
              </div>
              <div className="checkout-field">
                <label className="checkout-label" htmlFor="checkout-notes">
                  Catatan Pesanan (Opsional)
                </label>
                <input
                  id="checkout-notes"
                  className="checkout-input"
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={state.status !== "editing"}
                  placeholder="Instruksi pengiriman khusus (opsional)"
                />
              </div>
            </div>

            {error && (
              <ErrorAlert message={error} id="checkout-prepare-error" />
            )}

            <div className="checkout-actions-single">
              <button
                type="submit"
                className="primary-action purchase-action checkout-submit-button"
                disabled={state.status !== "editing"}
              >
                {state.status === "preparing" ? (
                  <>
                    <span className="animate-spin checkout-btn-spinner" />
                    <span>Memeriksa Ongkir...</span>
                  </>
                ) : (
                  <span>Pilih Pengiriman & Pembayaran &rarr;</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form className="checkout-form" onSubmit={handleSubmit}>
            <div className="checkout-form-section">
              <div className="checkout-section-header">
                <h2 className="checkout-form-title">
                  <span className="checkout-step-badge">1</span>
                  Pilih Layanan Pengiriman
                </h2>
                <span className="checkout-section-hint">
                  Ongkos kirim sesuai alamat tujuan Anda
                </span>
              </div>

              <div
                className="checkout-shipping-list"
                role="radiogroup"
                aria-label="Pilih Layanan Pengiriman"
              >
                {state.preview.choices.map((choice) => {
                  const isSelected =
                    state.selectedQuoteRef === choice.reference;
                  return (
                    <label
                      key={choice.reference}
                      htmlFor={`shipping-${choice.reference}`}
                      className={`checkout-shipping-card ${
                        isSelected ? "is-selected" : ""
                      }`}
                    >
                      <input
                        id={`shipping-${choice.reference}`}
                        type="radio"
                        name="shippingChoice"
                        value={choice.reference}
                        checked={isSelected}
                        onChange={() =>
                          setState({
                            ...state,
                            selectedQuoteRef: choice.reference,
                          })
                        }
                        disabled={state.status === "submitting"}
                        className="checkout-sr-radio"
                      />

                      <span
                        className="checkout-radio-indicator"
                        aria-hidden="true"
                      >
                        {isSelected && (
                          <span className="checkout-radio-inner" />
                        )}
                      </span>

                      <div className="checkout-shipping-icon-box">
                        <ShippingIcon size={18} />
                      </div>

                      <div className="checkout-shipping-details">
                        <span className="checkout-shipping-name">
                          {choice.courier} &bull; {choice.service}
                        </span>
                        {choice.estimate && (
                          <span className="checkout-shipping-estimate">
                            Estimasi: {choice.estimate}
                          </span>
                        )}
                      </div>

                      <div className="checkout-shipping-cost">
                        {formatIdr(choice.cost)}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div
              className="checkout-form-section"
              style={{ marginTop: "1rem" }}
            >
              <div className="checkout-section-header">
                <h2 className="checkout-form-title">
                  <span className="checkout-step-badge">2</span>
                  Pilih Metode Pembayaran
                </h2>
                <span className="checkout-section-hint">
                  Pilih rekening tujuan atau QRIS untuk transaksi
                </span>
              </div>

              <div
                className="checkout-payment-list"
                role="radiogroup"
                aria-label="Pilih Metode Pembayaran"
              >
                {state.preview.payments?.map((payment: PaymentMethodChoice) => {
                  const isSelected = paymentMethodId === payment.id;
                  return (
                    <label
                      key={payment.id}
                      htmlFor={`payment-${payment.id}`}
                      className={`checkout-payment-card ${
                        isSelected ? "is-selected" : ""
                      }`}
                    >
                      <input
                        id={`payment-${payment.id}`}
                        type="radio"
                        name="paymentChoice"
                        value={payment.id}
                        checked={isSelected}
                        onChange={() => setPaymentMethodId(payment.id)}
                        disabled={state.status === "submitting"}
                        className="checkout-sr-radio"
                      />

                      <span
                        className="checkout-radio-indicator"
                        aria-hidden="true"
                      >
                        {isSelected && (
                          <span className="checkout-radio-inner" />
                        )}
                      </span>

                      {/* Logo or Method Icon */}
                      <div className="checkout-payment-logo">
                        {payment.type === "qris" ? (
                          <Image
                            unoptimized
                            src="/images/qris.webp"
                            alt="QRIS"
                            width={56}
                            height={32}
                            className="checkout-logo-img"
                          />
                        ) : payment.logoUrl ? (
                          <Image
                            unoptimized
                            src={payment.logoUrl}
                            alt={payment.name}
                            width={56}
                            height={32}
                            className="checkout-logo-img"
                          />
                        ) : (
                          <BankIcon size={20} className="checkout-logo-icon" />
                        )}
                      </div>

                      <div className="checkout-payment-info">
                        <div className="checkout-payment-header">
                          <span className="checkout-payment-title">
                            {payment.bankName || payment.name}
                          </span>
                          <span className="checkout-payment-badge">
                            {payment.type === "qris" ? "QRIS" : "Bank Transfer"}
                          </span>
                        </div>

                        {payment.type === "qris" && payment.merchantName && (
                          <p className="checkout-payment-subtitle">
                            Merchant: {payment.merchantName}
                          </p>
                        )}

                        {payment.type === "bank_transfer" &&
                          payment.accountNumber && (
                            <div className="checkout-account-row">
                              <span className="checkout-account-number">
                                {payment.accountNumber}
                              </span>
                              <CopyButton
                                text={payment.accountNumber}
                                subject="Nomor rekening"
                              />
                            </div>
                          )}

                        {payment.accountHolder && (
                          <p className="checkout-payment-holder">
                            a.n. {payment.accountHolder}
                          </p>
                        )}

                        {payment.instructions && (
                          <p className="checkout-payment-instructions">
                            {payment.instructions}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {error && <ErrorAlert message={error} id="checkout-submit-error" />}

            <div className="checkout-actions">
              <button
                type="button"
                className="checkout-back-button"
                onClick={() => setState({ status: "editing" })}
                disabled={state.status === "submitting"}
              >
                <span aria-hidden="true">&larr;</span> Ubah Alamat
              </button>
              <button
                type="submit"
                className="primary-action purchase-action checkout-submit-button"
                disabled={state.status === "submitting"}
              >
                {state.status === "submitting" ? (
                  <>
                    <span className="animate-spin checkout-btn-spinner" />
                    <span>Memproses Pesanan...</span>
                  </>
                ) : (
                  <span>Buat Pesanan &rarr;</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      <aside className="cart-summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Ringkasan Pesanan</h2>
        {state.status === "quotes_ready" || state.status === "submitting" ? (
          (() => {
            const choice = state.preview.choices.find(
              (c) => c.reference === state.selectedQuoteRef,
            );
            const pricing = state.preview.cart.pricing;
            if (!pricing || !choice) return <p>Data tidak lengkap.</p>;
            return (
              <dl>
                <div>
                  <dt>Total produk</dt>
                  <dd>{formatIdr(pricing.merchandiseTotal)}</dd>
                </div>
                <div>
                  <dt
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <ShippingIcon
                      size={16}
                      style={{ color: "var(--muted-foreground)" }}
                    />
                    <span>Ongkos kirim ({choice.courier})</span>
                  </dt>
                  <dd>{formatIdr(choice.cost)}</dd>
                </div>
                <div className="cart-total">
                  <dt>Total tagihan</dt>
                  <dd>{formatIdr(choice.total)}</dd>
                </div>
              </dl>
            );
          })()
        ) : (
          <p
            className="small-note"
            style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}
          >
            <ShippingIcon
              size={16}
              style={{ marginTop: "2px", color: "var(--muted-foreground)" }}
            />
            <span>
              Isi informasi pengiriman untuk melihat total tagihan beserta
              ongkos kirim.
            </span>
          </p>
        )}
      </aside>
    </div>
  );
}
