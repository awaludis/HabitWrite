import { useState } from "react";
import { keyFormatWarning, normalizeKey, testConnection } from "../lib/ai";
import { DEFAULT_SCORING } from "../lib/scoring";
import { MODELS, type AppSettings, type Effort } from "../lib/storage";

export function SettingsScreen({ settings, onSave }: { settings: AppSettings; onSave: (s: AppSettings) => void }) {
  const [s, setS] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const formatWarning = keyFormatWarning(s.apiKey);

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      setTest({ ok: true, msg: await testConnection(s) });
    } catch (e) {
      setTest({ ok: false, msg: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };
  const scoring = s.scoring;
  const setScoring = (patch: Partial<typeof scoring>) => setS({ ...s, scoring: { ...scoring, ...patch } });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form className="stack" onSubmit={save}>
      <h1>Pengaturan</h1>

      <section className="card">
        <h2>Koneksi Claude</h2>
        <label className="field">
          <span>API key Anthropic</span>
          <div className="row nowrap">
            <input
              type={showKey ? "text" : "password"}
              name="anthropic-api-key"
              autoComplete="new-password"
              spellCheck={false}
              value={s.apiKey}
              // Strip header names, quotes and whitespace that often sneak in when copying the key.
              onChange={(e) => {
                setS({ ...s, apiKey: normalizeKey(e.target.value) });
                setTest(null);
              }}
              placeholder="sk-ant-api03-…"
            />
            <button type="button" className="btn small" onClick={() => setShowKey(!showKey)}>
              {showKey ? "Sembunyikan" : "Tampilkan"}
            </button>
          </div>
        </label>
        {s.apiKey && (
          <p className="muted small">
            Terisi: <code>{s.apiKey.slice(0, 14)}…{s.apiKey.slice(-4)}</code> ({s.apiKey.length} karakter)
          </p>
        )}
        {formatWarning && <div className="notice warn">{formatWarning}</div>}
        <p className="muted small">
          Key disimpan hanya di perangkat ini (penyimpanan browser) dan dikirim langsung ke Claude API. Jangan gunakan aplikasi ini
          dengan key milik orang lain di perangkat bersama.
        </p>
        <label className="field">
          <span>Alamat proxy (opsional)</span>
          <input
            value={s.baseUrl}
            onChange={(e) => setS({ ...s, baseUrl: e.target.value.trim() })}
            placeholder="https://proxy.perusahaan.example (kosongkan untuk langsung ke Anthropic)"
          />
        </label>
        <div className="grid2">
          <label className="field">
            <span>Model</span>
            <select value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Ketelitian penilaian (effort)</span>
            <select value={s.effort} onChange={(e) => setS({ ...s, effort: e.target.value as Effort })}>
              <option value="low">Rendah (cepat)</option>
              <option value="medium">Sedang</option>
              <option value="high">Tinggi (lebih teliti, lebih lambat)</option>
            </select>
          </label>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={runTest} disabled={testing || (!s.apiKey && !s.baseUrl)}>
            {testing ? "Mengetes…" : "Tes koneksi"}
          </button>
          <span className="muted small">Mengecek key dan model tanpa memakai kredit.</span>
        </div>
        {test && <div className={`notice ${test.ok ? "ok" : "error"}`}>{test.msg}</div>}
      </section>

      <section className="card">
        <h2>Penilaian</h2>
        <p className="muted small">Berlaku untuk sesi baru. Sesi lama tetap memakai aturan saat sesi itu dibuat.</p>
        <label className="field">
          <span>
            Bobot kata kunci : kualitas = <strong>{scoring.keywordWeight} : {100 - scoring.keywordWeight}</strong>
          </span>
          <input
            type="range"
            min={20}
            max={80}
            step={5}
            value={scoring.keywordWeight}
            onChange={(e) => setScoring({ keywordWeight: Number(e.target.value) })}
          />
        </label>
        <div className="grid2">
          <label className="field">
            <span>Potongan skor per revisi (%)</span>
            <input
              type="number"
              min={0}
              max={50}
              value={scoring.revisionPenaltyPct}
              onChange={(e) => setScoring({ revisionPenaltyPct: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
            />
          </label>
          <label className="field">
            <span>Batas revisi per paragraf</span>
            <input
              type="number"
              min={0}
              max={5}
              value={scoring.maxRevisions}
              onChange={(e) => setScoring({ maxRevisions: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })}
            />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={s.examModeDefault} onChange={(e) => setS({ ...s, examModeDefault: e.target.checked })} />
          <span>Aktifkan mode ujian (tanpa tempel) secara bawaan</span>
        </label>
        <button type="button" className="btn small ghost" onClick={() => setS({ ...s, scoring: DEFAULT_SCORING })}>
          Kembalikan ke bawaan (50:50, potongan 5%, maks. 2 revisi)
        </button>
      </section>

      <div className="row end">
        {saved && <span className="muted">Tersimpan ✓</span>}
        <button className="btn primary" type="submit">Simpan</button>
      </div>
    </form>
  );
}
