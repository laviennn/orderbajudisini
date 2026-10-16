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
import { DownloadQrisButton } from "./DownloadQrisButton";

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
        <h1>Checkout</h1>
        {error && <ErrorAlert message={error} id="checkout-top-error" />}

        {state.status === "editing" || state.status === "preparing" ? (
          <form className="filter-form" onSubmit={handlePrepare}>
            <h2>Informasi Pemesan</h2>
            <label>
              Nama Lengkap
              <input
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={state.status !== "editing"}
              />
            </label>
            <label>
              Email (Opsional)
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={state.status !== "editing"}
              />
            </label>
            <label>
              Nomor WhatsApp / HP
              <input
                required
                minLength={8}
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={state.status !== "editing"}
                placeholder="08..."
              />
            </label>

            <h2 style={{ marginTop: "1.5rem" }}>Tujuan Pengiriman</h2>
            <label
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <input
                type="checkbox"
                checked={sameAsBuyer}
                onChange={(e) => setSameAsBuyer(e.target.checked)}
                disabled={state.status !== "editing"}
                style={{ width: "auto", minHeight: "auto" }}
              />
              Sama dengan nama pemesan
            </label>
            {!sameAsBuyer && (
              <label>
                Nama Penerima
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  disabled={state.status !== "editing"}
                />
              </label>
            )}
            <label>
              Alamat Lengkap
              <input
                required
                minLength={5}
                maxLength={500}
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                disabled={state.status !== "editing"}
              />
            </label>
            <div className="price-inputs">
              <label>
                Provinsi
                <input
                  required
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  disabled={state.status !== "editing"}
                />
              </label>
              <label>
                Kota / Kabupaten
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={state.status !== "editing"}
                />
              </label>
            </div>
            <div className="price-inputs">
              <label>
                Kecamatan
                <input
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={state.status !== "editing"}
                />
              </label>
              <label>
                Kelurahan (Opsional)
                <input
                  value={subdistrict}
                  onChange={(e) => setSubdistrict(e.target.value)}
                  disabled={state.status !== "editing"}
                />
              </label>
            </div>
            <label>
              Kode Pos
              <input
                required
                pattern="[0-9]{5}"
                maxLength={5}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                disabled={state.status !== "editing"}
              />
            </label>
            <label>
              Catatan Pesanan (Opsional)
              <input
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={state.status !== "editing"}
              />
            </label>

            {error && (
              <ErrorAlert message={error} id="checkout-prepare-error" />
            )}

            <button
              type="submit"
              className="primary-action purchase-action"
              style={{ marginTop: error ? "0.5rem" : "1.5rem" }}
              disabled={state.status !== "editing"}
            >
              {state.status === "preparing"
                ? "Memeriksa Ongkir..."
                : "Pilih Pengiriman"}
            </button>
          </form>
        ) : (
          <form className="filter-form" onSubmit={handleSubmit}>
            <h2>Pilih Layanan Pengiriman</h2>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {state.preview.choices.map((choice) => (
                <label
                  key={choice.reference}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: "1rem",
                    border: "1px solid var(--border)",
                    padding: "1rem",
                    borderRadius: "var(--radius-control)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="shippingChoice"
                    value={choice.reference}
                    checked={state.selectedQuoteRef === choice.reference}
                    onChange={() =>
                      setState({ ...state, selectedQuoteRef: choice.reference })
                    }
                    disabled={state.status === "submitting"}
                    style={{
                      width: "auto",
                      minHeight: "auto",
                      marginTop: "4px",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <ShippingIcon
                        size={18}
                        style={{ color: "var(--muted-foreground)" }}
                      />
                      <h3 style={{ margin: 0 }}>
                        {choice.courier} - {choice.service}
                      </h3>
                    </div>
                    {choice.estimate && (
                      <p
                        className="small-note"
                        style={{ margin: "0.25rem 0 0" }}
                      >
                        Estimasi: {choice.estimate}
                      </p>
                    )}
                  </div>
                  <div style={{ fontWeight: 500 }}>
                    {formatIdr(choice.cost)}
                  </div>
                </label>
              ))}
            </div>

            <h2 style={{ marginTop: "2rem" }}>Pilih Metode Pembayaran</h2>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {state.preview.payments?.map((payment: PaymentMethodChoice) => {
                const isSelected = paymentMethodId === payment.id;
                return (
                  <label
                    key={payment.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "1rem",
                      border: isSelected
                        ? "1.5px solid var(--foreground)"
                        : "1px solid var(--border)",
                      padding: "1rem 1.25rem",
                      borderRadius: "var(--radius-control)",
                      backgroundColor: isSelected
                        ? "var(--surface-subtle)"
                        : "var(--surface)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <input
                      type="radio"
                      name="paymentChoice"
                      value={payment.id}
                      checked={isSelected}
                      onChange={() => setPaymentMethodId(payment.id)}
                      disabled={state.status === "submitting"}
                      style={{
                        width: "auto",
                        minHeight: "auto",
                        marginTop: "6px",
                      }}
                    />

                    {/* Logo or Method Icon */}
                    <div
                      style={{
                        width: "68px",
                        height: "44px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        backgroundColor: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        padding: "4px",
                        flexShrink: 0,
                      }}
                    >
                      {payment.type === "qris" ? (
                        <Image
                          unoptimized
                          src="/images/qris.webp"
                          alt="QRIS"
                          width={60}
                          height={36}
                          style={{
                            objectFit: "contain",
                            maxHeight: "100%",
                            width: "auto",
                          }}
                        />
                      ) : payment.logoUrl ? (
                        <Image
                          unoptimized
                          src={payment.logoUrl}
                          alt={payment.name}
                          width={60}
                          height={36}
                          style={{
                            objectFit: "contain",
                            maxHeight: "100%",
                            width: "auto",
                          }}
                        />
                      ) : (
                        <BankIcon
                          size={24}
                          style={{ color: "var(--foreground)" }}
                        />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "1rem",
                            fontWeight: 600,
                          }}
                        >
                          {payment.bankName || payment.name}
                        </h3>
                      </div>

                      {payment.type === "qris" && payment.merchantName && (
                        <p
                          className="small-note"
                          style={{
                            margin: "0.25rem 0 0",
                            fontSize: "0.8125rem",
                          }}
                        >
                          {payment.merchantName}
                        </p>
                      )}

                      {payment.type === "qris" && isSelected && payment.qrisImageUrl && (
                        <div
                          style={{
                            marginTop: "0.875rem",
                            padding: "0.875rem",
                            backgroundColor: "#fafaf9",
                            borderRadius: "8px",
                            border: "1px solid var(--border, #d4d5cc)",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              padding: "0.5rem",
                              backgroundColor: "#ffffff",
                              borderRadius: "6px",
                              border: "1px solid var(--border, #d4d5cc)",
                              display: "inline-block",
                              marginBottom: "0.75rem",
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={payment.qrisImageUrl}
                              alt="Kode QRIS"
                              style={{
                                maxWidth: "200px",
                                maxHeight: "200px",
                                objectFit: "contain",
                                display: "block",
                                margin: "0 auto",
                              }}
                            />
                          </div>
                          <div>
                            <DownloadQrisButton
                              imageUrl={payment.qrisImageUrl}
                              merchantName={payment.merchantName}
                            />
                          </div>
                        </div>
                      )}

                      {payment.type === "bank_transfer" &&
                        payment.accountNumber && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.625rem",
                              marginTop: "0.375rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "var(--font-mono, monospace)",
                                fontSize: "0.9375rem",
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                              }}
                            >
                              {payment.accountNumber}
                            </span>
                            <CopyButton
                              text={payment.accountNumber}
                              subject="Nomor rekening"
                            />
                          </div>
                        )}

                      {payment.accountHolder && (
                        <p
                          className="small-note"
                          style={{
                            margin: "0.25rem 0 0",
                            fontSize: "0.8125rem",
                          }}
                        >
                          A.n. {payment.accountHolder}
                        </p>
                      )}

                      {payment.instructions && (
                        <p
                          className="small-note"
                          style={{
                            margin: "0.375rem 0 0",
                            fontSize: "0.8125rem",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          {payment.instructions}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            {error && <ErrorAlert message={error} id="checkout-submit-error" />}

            <div
              style={{
                display: "flex",
                gap: "1rem",
                marginTop: error ? "0.75rem" : "2rem",
              }}
            >
              <button
                type="button"
                className="text-link"
                onClick={() => setState({ status: "editing" })}
                disabled={state.status === "submitting"}
              >
                Ubah Alamat
              </button>
              <button
                type="submit"
                className="primary-action purchase-action"
                disabled={state.status === "submitting"}
                style={{ flex: 1 }}
              >
                {state.status === "submitting"
                  ? "Memproses..."
                  : "Buat Pesanan"}
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
