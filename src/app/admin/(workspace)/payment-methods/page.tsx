import { requirePermission } from "@/server/auth/authorize";
import { listBankAccounts, getQrisSettings } from "@/server/services/settings";
import { getStorage } from "@/server/storage/r2";
import { QrisEditor } from "@/features/admin/QrisEditor";
import { submitBankAccountAction, deleteBankAccountAction } from "./actions";

export const metadata = { title: "Metode Pembayaran - Admin" };

export default async function PaymentMethodsPage() {
  await requirePermission("settings.read");
  const [bankAccounts, qrisSettings] = await Promise.all([
    listBankAccounts(),
    getQrisSettings(),
  ]);

  let qrisImageUrl: string | null = null;
  if (qrisSettings?.imageObjectKey) {
    try {
      qrisImageUrl = getStorage().publicMediaUrl(qrisSettings.imageObjectKey);
    } catch {
      qrisImageUrl = null;
    }
  }

  return (
    <div className="admin-content">
      <div className="section-heading">
        <div>
          <h1>Metode Pembayaran</h1>
          <p className="small-note">
            Kelola rekening transfer bank manual dan QRIS Statis untuk proses
            checkout pelanggan.
          </p>
        </div>
      </div>

      <section style={{ marginBottom: "3rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Rekening Bank Transfer</h2>
        <div style={{ display: "grid", gap: "1.5rem", maxWidth: "800px" }}>
          {bankAccounts.map((bank) => (
            <div
              key={bank.id}
              className="admin-editor"
              style={{
                border: "1px solid var(--border)",
                padding: "1.5rem",
                borderRadius: "var(--radius-control)",
                backgroundColor: "var(--surface)",
              }}
            >
              <form action={submitBankAccountAction}>
                <input type="hidden" name="id" value={bank.id} />
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend
                    style={{
                      fontWeight: 600,
                      fontSize: "1.1rem",
                      marginBottom: "1rem",
                    }}
                  >
                    {bank.bankName} — {bank.accountNumber}
                  </legend>
                  <div className="editor-grid">
                    <label>
                      Nama Bank
                      <input
                        type="text"
                        name="bankName"
                        defaultValue={bank.bankName}
                        required
                        maxLength={120}
                      />
                    </label>
                    <label>
                      Nomor Rekening
                      <input
                        type="text"
                        name="accountNumber"
                        defaultValue={bank.accountNumber}
                        required
                        pattern="^[0-9]{4,40}$"
                        title="Nomor rekening berupa 4-40 digit angka"
                      />
                    </label>
                  </div>
                  <div className="editor-grid">
                    <label>
                      Nama Pemilik Rekening
                      <input
                        type="text"
                        name="accountHolder"
                        defaultValue={bank.accountHolder}
                        required
                        maxLength={200}
                      />
                    </label>
                    <label>
                      Urutan Tampilan
                      <input
                        type="number"
                        name="sortOrder"
                        defaultValue={bank.sortOrder}
                        required
                        min={0}
                        max={1000}
                      />
                    </label>
                  </div>
                  <label style={{ display: "block", marginBottom: "1rem" }}>
                    Instruksi Pembayaran (Opsional)
                    <textarea
                      name="instructions"
                      defaultValue={bank.instructions || ""}
                      rows={2}
                      maxLength={2000}
                    />
                  </label>
                  <label
                    className="checkbox-label"
                    style={{ marginBottom: "1.25rem" }}
                  >
                    <input
                      type="checkbox"
                      name="active"
                      value="true"
                      defaultChecked={bank.active}
                    />
                    <span>Aktifkan rekening ini di checkout</span>
                  </label>
                  <div className="editor-actions" style={{ marginBottom: 0 }}>
                    <button type="submit" className="primary-action">
                      Simpan Perubahan
                    </button>
                  </div>
                </fieldset>
              </form>
              <form
                action={deleteBankAccountAction}
                style={{ marginTop: "0.75rem" }}
              >
                <input type="hidden" name="id" value={bank.id} />
                <button
                  type="submit"
                  className="text-link"
                  style={{ color: "var(--danger)" }}
                  onClick={(e) => {
                    if (!confirm("Hapus rekening bank ini?")) {
                      e.preventDefault();
                    }
                  }}
                >
                  Hapus Rekening
                </button>
              </form>
            </div>
          ))}

          {/* Form Tambah Bank Baru */}
          <div
            className="admin-editor"
            style={{
              border: "1px dashed var(--border)",
              padding: "1.5rem",
              borderRadius: "var(--radius-control)",
              backgroundColor: "var(--surface)",
            }}
          >
            <form action={submitBankAccountAction}>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend
                  style={{
                    fontWeight: 600,
                    fontSize: "1.1rem",
                    marginBottom: "1rem",
                  }}
                >
                  Tambah Rekening Baru
                </legend>
                <div className="editor-grid">
                  <label>
                    Nama Bank
                    <input
                      type="text"
                      name="bankName"
                      placeholder="Contoh: BCA / Mandiri / BNI"
                      required
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Nomor Rekening
                    <input
                      type="text"
                      name="accountNumber"
                      placeholder="Contoh: 1234567890"
                      required
                      pattern="^[0-9]{4,40}$"
                      title="Nomor rekening berupa 4-40 digit angka"
                    />
                  </label>
                </div>
                <div className="editor-grid">
                  <label>
                    Nama Pemilik Rekening
                    <input
                      type="text"
                      name="accountHolder"
                      placeholder="Contoh: PT Thrift Indonesia"
                      required
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Urutan Tampilan
                    <input
                      type="number"
                      name="sortOrder"
                      defaultValue="0"
                      required
                      min={0}
                      max={1000}
                    />
                  </label>
                </div>
                <label style={{ display: "block", marginBottom: "1rem" }}>
                  Instruksi Pembayaran (Opsional)
                  <textarea
                    name="instructions"
                    placeholder="Contoh: Masukkan berita transfer dengan nomor pesanan Anda."
                    rows={2}
                    maxLength={2000}
                  />
                </label>
                <label
                  className="checkbox-label"
                  style={{ marginBottom: "1.25rem" }}
                >
                  <input
                    type="checkbox"
                    name="active"
                    value="true"
                    defaultChecked
                  />
                  <span>Aktifkan langsung</span>
                </label>
                <div className="editor-actions" style={{ marginBottom: 0 }}>
                  <button type="submit" className="secondary-action">
                    Tambah Rekening Bank
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "3rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>QRIS Statis</h2>
        <QrisEditor
          initialSettings={qrisSettings}
          initialImageUrl={qrisImageUrl}
        />
      </section>
    </div>
  );
}
