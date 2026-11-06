import { useState } from "react";
import { DEFAULT_SCORING } from "../lib/scoring";
import { MODELS, type AppSettings, type Effort } from "../lib/storage";

export function SettingsScreen({ settings, onSave }: { settings: AppSettings; onSave: (s: AppSettings) => void }) {
  const [s, setS] = useState(settings);
  const [saved, setSaved] = useState(false);
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
          <input
            type="password"
            autoComplete="off"
            value={s.apiKey}
            onChange={(e) => setS({ ...s, apiKey: e.target.value.trim() })}
            placeholder="sk-ant-…"
          />
        </label>
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
