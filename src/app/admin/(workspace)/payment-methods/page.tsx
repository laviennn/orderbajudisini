import { requirePermission } from "@/server/auth/authorize";
import { listBankAccounts, getQrisSettings } from "@/server/services/settings";
import { submitBankAccountAction, submitQrisSettingsAction } from "./actions";

export const metadata = { title: "Metode Pembayaran - Admin" };

export default async function PaymentMethodsPage() {
  await requirePermission("settings.read");
  const [bankAccounts, qrisSettings] = await Promise.all([
    listBankAccounts(),
    getQrisSettings(),
  ]);

  return (
    <main id="main-content">
      <h1>Metode Pembayaran</h1>
      <p>Kelola rekening bank manual dan QRIS Statis.</p>

      <section style={{ marginTop: "2rem" }}>
        <h2>Bank Transfer</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {bankAccounts.map(bank => (
            <div key={bank.id} style={{ border: "1px solid var(--border)", padding: "1rem", borderRadius: "var(--radius-sm)" }}>
              <form action={submitBankAccountAction} style={{ display: "grid", gap: "1rem" }}>
                <input type="hidden" name="id" value={bank.id} />
                <div className="field-group">
                  <label>Nama Bank</label>
                  <input type="text" name="bankName" defaultValue={bank.bankName} required />
                </div>
                <div className="field-group">
                  <label>Nomor Rekening</label>
                  <input type="text" name="accountNumber" defaultValue={bank.accountNumber} required />
                </div>
                <div className="field-group">
                  <label>Nama Pemilik</label>
                  <input type="text" name="accountHolder" defaultValue={bank.accountHolder} required />
                </div>
                <div className="field-group">
                  <label>Instruksi Pembayaran</label>
                  <textarea name="instructions" defaultValue={bank.instructions || ""} rows={3} />
                </div>
                <div className="field-group">
                  <label>Urutan (Sort Order)</label>
                  <input type="number" name="sortOrder" defaultValue={bank.sortOrder} required />
                </div>
                <label className="checkbox-label">
                  <input type="checkbox" name="active" value="true" defaultChecked={bank.active} />
                  <span>Aktif</span>
                </label>
                <div><button className="primary" type="submit">Simpan Bank</button></div>
              </form>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "2rem", border: "1px dashed var(--border)", padding: "1rem", borderRadius: "var(--radius-sm)" }}>
          <h3>Tambah Bank Baru</h3>
          <form action={submitBankAccountAction} style={{ display: "grid", gap: "1rem" }}>
            <div className="field-group">
              <label>Nama Bank</label>
              <input type="text" name="bankName" required />
            </div>
            <div className="field-group">
              <label>Nomor Rekening</label>
              <input type="text" name="accountNumber" required />
            </div>
            <div className="field-group">
              <label>Nama Pemilik</label>
              <input type="text" name="accountHolder" required />
            </div>
            <div className="field-group">
              <label>Instruksi Pembayaran</label>
              <textarea name="instructions" rows={3} />
            </div>
            <div className="field-group">
              <label>Urutan</label>
              <input type="number" name="sortOrder" defaultValue="0" required />
            </div>
            <label className="checkbox-label">
              <input type="checkbox" name="active" value="true" />
              <span>Aktif</span>
            </label>
            <div><button className="primary" type="submit">Tambah Bank</button></div>
          </form>
        </div>
      </section>

      <section style={{ marginTop: "3rem" }}>
        <h2>QRIS Statis</h2>
        <form action={submitQrisSettingsAction} style={{ display: "grid", gap: "1rem", border: "1px solid var(--border)", padding: "1rem", borderRadius: "var(--radius-sm)" }}>
          <div className="field-group">
            <label>Nama Merchant (Opsional)</label>
            <input type="text" name="merchantName" defaultValue={qrisSettings?.merchantName || ""} />
          </div>
          <div className="field-group">
            <label>Object Key Gambar QRIS (R2 Public Bucket)</label>
            <input type="text" name="imageObjectKey" defaultValue={qrisSettings?.imageObjectKey || ""} required />
            <p className="help-text">Unggah gambar QRIS ke R2 dan masukkan nama filenya (contoh: qris-toko.png).</p>
          </div>
          <div className="field-group">
            <label>Instruksi Pembayaran</label>
            <textarea name="instructions" defaultValue={qrisSettings?.instructions || ""} rows={3} />
          </div>
          <label className="checkbox-label">
            <input type="checkbox" name="active" value="true" defaultChecked={qrisSettings?.active} />
            <span>Aktifkan QRIS</span>
          </label>
          <div><button className="primary" type="submit">Simpan QRIS</button></div>
        </form>
      </section>
    </main>
  );
}
