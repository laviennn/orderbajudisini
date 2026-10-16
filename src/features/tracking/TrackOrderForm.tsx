"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, AlertCircleIcon } from "@/features/checkout/Icons";

interface TrackOrderFormProps {
  initialOrderNumber?: string;
  initialPhone?: string;
}

export function TrackOrderForm({
  initialOrderNumber = "",
  initialPhone = "",
}: TrackOrderFormProps) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedOrder = orderNumber.trim().toUpperCase();
    const trimmedPhone = phone.trim();

    if (!trimmedOrder) {
      setError("Silakan masukkan nomor pesanan Anda.");
      return;
    }
    if (!trimmedPhone) {
      setError("Silakan masukkan nomor WhatsApp atau handphone Anda.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/order/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderNumber: trimmedOrder,
          phone: trimmedPhone,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        let msg = data?.message || "Pesanan tidak ditemukan.";
        if (data?.fieldErrors?.orderNumber?.[0]) {
          msg = data.fieldErrors.orderNumber[0];
        } else if (data?.fieldErrors?.phone?.[0]) {
          msg = data.fieldErrors.phone[0];
        }
        throw new Error(msg);
      }

      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        throw new Error("Terjadi kesalahan memuat data pesanan.");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Gagal melacak pesanan. Silakan periksa kembali data Anda.");
      }
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.625rem",
            padding: "0.875rem 1rem",
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "8px",
            color: "var(--danger, #dc2626)",
            fontSize: "0.875rem",
            lineHeight: 1.5,
          }}
        >
          <AlertCircleIcon
            size={18}
            style={{ flexShrink: 0, marginTop: "2px" }}
          />
          <div>{error}</div>
        </div>
      )}

      {/* Order Number Field */}
      <div>
        <label
          htmlFor="track-order-number"
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 700,
            marginBottom: "0.375rem",
            color: "var(--foreground, #242922)",
          }}
        >
          Nomor Pesanan{" "}
          <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
        </label>
        <input
          id="track-order-number"
          type="text"
          placeholder="Contoh: ORD-20261015-72E4BA942DB6"
          value={orderNumber}
          onChange={(e) => {
            setError(null);
            setOrderNumber(e.target.value.toUpperCase());
          }}
          disabled={loading}
          autoComplete="off"
          style={{
            width: "100%",
            height: "48px",
            padding: "0.625rem 0.875rem",
            fontSize: "0.95rem",
            fontFamily: "var(--font-mono, monospace)",
            letterSpacing: "0.02em",
            border: "1px solid var(--border, #d4d5cc)",
            borderRadius: "6px",
            backgroundColor: "#ffffff",
            color: "var(--foreground, #242922)",
            outline: "none",
            transition: "border-color 0.15s ease",
          }}
        />
        <p
          style={{
            margin: "0.375rem 0 0",
            fontSize: "0.78rem",
            color: "var(--muted-foreground, #62675c)",
          }}
        >
          Nomor pesanan terdapat di invoice atau pesan WhatsApp toko kami.
        </p>
      </div>

      {/* Phone Number Field */}
      <div>
        <label
          htmlFor="track-phone"
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 700,
            marginBottom: "0.375rem",
            color: "var(--foreground, #242922)",
          }}
        >
          Nomor WhatsApp / Handphone{" "}
          <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
        </label>
        <input
          id="track-phone"
          type="tel"
          placeholder="Contoh: 08123456789 atau +628123456789"
          value={phone}
          onChange={(e) => {
            setError(null);
            setPhone(e.target.value);
          }}
          disabled={loading}
          autoComplete="tel"
          style={{
            width: "100%",
            height: "48px",
            padding: "0.625rem 0.875rem",
            fontSize: "0.95rem",
            border: "1px solid var(--border, #d4d5cc)",
            borderRadius: "6px",
            backgroundColor: "#ffffff",
            color: "var(--foreground, #242922)",
            outline: "none",
            transition: "border-color 0.15s ease",
          }}
        />
        <p
          style={{
            margin: "0.375rem 0 0",
            fontSize: "0.78rem",
            color: "var(--muted-foreground, #62675c)",
          }}
        >
          Nomor yang Anda gunakan saat mengisi detail alamat pengiriman.
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="button-primary"
        disabled={loading}
        style={{
          width: "100%",
          minHeight: "50px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.625rem",
          padding: "0.75rem 1.5rem",
          backgroundColor: "var(--primary, #354a37)",
          color: "#ffffff",
          border: "none",
          borderRadius: "6px",
          fontWeight: 700,
          fontSize: "1rem",
          cursor: loading ? "wait" : "pointer",
          boxShadow: "0 2px 6px rgba(53, 74, 55, 0.2)",
          transition: "all 0.2s ease",
          marginTop: "0.5rem",
        }}
      >
        <SearchIcon size={19} />
        <span>{loading ? "Mencari Pesanan..." : "Lacak Pesanan Sekarang"}</span>
      </button>
    </form>
  );
}
