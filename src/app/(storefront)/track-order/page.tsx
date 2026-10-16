import type { Metadata } from "next";
import Link from "next/link";
import { ShippingIcon, WhatsAppIcon } from "@/features/checkout/Icons";
import { TrackOrderForm } from "@/features/tracking/TrackOrderForm";
import { storeForShell } from "@/server/services/storefront";

export const metadata: Metadata = {
  title: "Lacak Pesanan - Thrift Commerce | Orderbajudisini.com",
  description:
    "Lacak status pesanan, verifikasi bukti pembayaran, dan resi pengiriman baju thrift Anda secara real-time.",
  robots: { index: true, follow: true },
};

export default async function TrackOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; phone?: string }>;
}) {
  const { order = "", phone = "" } = await searchParams;
  const store = await storeForShell();
  const rawWa = store.details?.whatsappNumber || "";
  const cleanWa = rawWa.replace(/\D/g, "");
  const waUrl = cleanWa
    ? `https://wa.me/${cleanWa}?text=${encodeURIComponent(
        "Halo Admin, saya butuh bantuan untuk melacak status pesanan saya. Terima kasih!",
      )}`
    : null;

  return (
    <main
      className="page-width section-space"
      style={{
        paddingTop: "2.5rem",
        paddingBottom: "5rem",
        maxWidth: "680px",
        margin: "0 auto",
      }}
    >
      {/* Back Link */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          href="/"
          className="text-link"
          style={{
            fontSize: "0.875rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            color: "var(--muted-foreground, #62675c)",
            textDecoration: "none",
          }}
        >
          <span aria-hidden="true">&larr;</span> Kembali ke Beranda
        </Link>
      </div>

      {/* Hero Header */}
      <header style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            backgroundColor: "var(--accent, #e3e8dd)",
            color: "var(--primary, #354a37)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
          }}
        >
          <ShippingIcon size={26} />
        </div>
        <h1
          style={{
            fontSize: "clamp(1.75rem, 3.5vw, 2.25rem)",
            fontWeight: 700,
            color: "var(--foreground, #242922)",
            margin: "0 0 0.5rem",
            fontFamily: "var(--font-display, Georgia, serif)",
          }}
        >
          Lacak Pesanan Anda
        </h1>
        <p
          style={{
            margin: "0 auto",
            fontSize: "0.95rem",
            color: "var(--muted-foreground, #62675c)",
            lineHeight: 1.5,
            maxWidth: "520px",
          }}
        >
          Masukkan nomor pesanan dan nomor handphone yang Anda gunakan saat
          checkout untuk melihat status pesanan, pembayaran, dan nomor resi
          pengiriman.
        </p>
      </header>

      {/* Main Tracking Form Card */}
      <section
        aria-label="Formulir Pelacakan"
        style={{
          background: "#ffffff",
          border: "1px solid var(--border, #d4d5cc)",
          borderRadius: "12px",
          padding: "clamp(1.5rem, 4vw, 2.25rem)",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.06)",
          marginBottom: "2.5rem",
        }}
      >
        <TrackOrderForm initialOrderNumber={order} initialPhone={phone} />
      </section>

      {/* Info & Guide Section */}
      <section
        aria-label="Panduan & Bantuan"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {/* Card 1: Di mana menemukan nomor pesanan */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            backgroundColor: "#ffffff",
            border: "1px solid var(--border, #d4d5cc)",
            borderRadius: "10px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
        >
          <h2
            style={{
              margin: "0 0 0.375rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "var(--foreground, #242922)",
            }}
          >
            Di mana saya bisa menemukan Nomor Pesanan?
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              color: "var(--muted-foreground, #62675c)",
              lineHeight: 1.5,
            }}
          >
            Nomor pesanan diawali dengan <strong>ORD-</strong> (misal:{" "}
            <code>ORD-20261015-72E4BA942DB6</code>). Anda dapat menemukannya di
            pesan konfirmasi WhatsApp toko kami atau pada layar setelah Anda
            menyelesaikan checkout.
          </p>
        </div>

        {/* Card 2: Alur proses pesanan */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            backgroundColor: "#ffffff",
            border: "1px solid var(--border, #d4d5cc)",
            borderRadius: "10px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
        >
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "var(--foreground, #242922)",
            }}
          >
            Tahapan Status Pesanan
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              fontSize: "0.8rem",
            }}
          >
            <span
              style={{
                padding: "0.25rem 0.6rem",
                borderRadius: "4px",
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#b45309",
                fontWeight: 600,
              }}
            >
              1. Menunggu Pembayaran
            </span>
            <span
              style={{
                color: "var(--muted-foreground, #62675c)",
                alignSelf: "center",
              }}
            >
              &rarr;
            </span>
            <span
              style={{
                padding: "0.25rem 0.6rem",
                borderRadius: "4px",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#15803d",
                fontWeight: 600,
              }}
            >
              2. Bukti Diverifikasi
            </span>
            <span
              style={{
                color: "var(--muted-foreground, #62675c)",
                alignSelf: "center",
              }}
            >
              &rarr;
            </span>
            <span
              style={{
                padding: "0.25rem 0.6rem",
                borderRadius: "4px",
                backgroundColor: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#047857",
                fontWeight: 600,
              }}
            >
              3. Dikemas & Diproses
            </span>
            <span
              style={{
                color: "var(--muted-foreground, #62675c)",
                alignSelf: "center",
              }}
            >
              &rarr;
            </span>
            <span
              style={{
                padding: "0.25rem 0.6rem",
                borderRadius: "4px",
                backgroundColor: "#faf5ff",
                border: "1px solid #e9d5ff",
                color: "#7e22ce",
                fontWeight: 600,
              }}
            >
              4. Dikirim (Resi Terbit)
            </span>
          </div>
        </div>

        {/* Card 3: Butuh Bantuan */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 0.25rem",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "#166534",
              }}
            >
              Butuh Bantuan atau Lupa Nomor Pesanan?
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "0.85rem",
                color: "#374151",
              }}
            >
              Hubungi Admin toko kami via WhatsApp untuk pengecekan pesanan
              manual.
            </p>
          </div>
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button-whatsapp"
              style={{
                width: "auto",
                minHeight: "42px",
                padding: "0.5rem 1.25rem",
                fontSize: "0.875rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <WhatsAppIcon size={16} />
              <span>Chat Admin WhatsApp</span>
            </a>
          ) : (
            <Link
              href="/products"
              className="button-secondary"
              style={{
                minHeight: "42px",
                padding: "0.5rem 1.25rem",
                fontSize: "0.875rem",
              }}
            >
              <span>Kembali Belanja</span>
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
