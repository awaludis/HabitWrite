import { useState } from "react";
import { navigate } from "../App";
import { AiError, generateOutline } from "../lib/ai";
import { extractText } from "../lib/extract";
import { saveSession, uid, type AppSettings } from "../lib/storage";
import type { Difficulty, Language, ReferenceMaterial, Session, SessionConfig, WritingType } from "../lib/types";

const MAX_REF_CHARS = 400_000;

export function NewSessionScreen({ settings }: { settings: AppSettings }) {
  const [refs, setRefs] = useState<ReferenceMaterial[]>([]);
  const [pasteName, setPasteName] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [config, setConfig] = useState<SessionConfig>({
    writingType: "artikel",
    language: "id",
    paragraphCount: 4,
    difficulty: "sedang",
    examMode: settings.examModeDefault,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalChars = refs.reduce((n, r) => n + r.text.length, 0);

  const addPasted = () => {
    if (!pasteText.trim()) return;
    setRefs([...refs, { id: uid(), name: pasteName.trim() || `Teks ${refs.length + 1}`, text: pasteText.trim() }]);
    setPasteName("");
    setPasteText("");
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const added: ReferenceMaterial[] = [];
    for (const f of Array.from(files)) {
      setBusy(`Membaca ${f.name}…`);
      try {
        const text = await extractText(f);
        if (text) added.push({ id: uid(), name: f.name, text });
        else setError(`${f.name}: tidak ada teks yang bisa dibaca.`);
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      }
    }
    setRefs((r) => [...r, ...added]);
    setBusy(null);
  };

  const start = async () => {
    setError(null);
    const all = [...refs];
    if (pasteText.trim()) all.push({ id: uid(), name: pasteName.trim() || `Teks ${all.length + 1}`, text: pasteText.trim() });
    if (!all.length) return setError("Tambahkan minimal satu bahan referensi.");
    if (all.reduce((n, r) => n + r.text.length, 0) > MAX_REF_CHARS)
      return setError("Bahan referensi terlalu panjang. Kurangi bahan atau pilih bagian yang relevan saja.");

    const session: Session = {
      id: uid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      references: all,
      config,
      scoring: settings.scoring,
      paragraphs: [],
      current: 0,
    };
    setBusy("AI sedang menyusun kerangka dan kata kunci…");
    try {
      const outline = await generateOutline(settings, all, config);
      session.outline = outline;
      session.paragraphs = outline.paragraphs.map(() => ({ draft: "", attempts: [], done: false }));
      await saveSession(session);
      navigate(`/session/${session.id}`);
    } catch (e) {
      setError(e instanceof AiError ? e.message : `Gagal membuat kerangka: ${(e as Error).message}`);
      setBusy(null);
    }
  };

  const set = <K extends keyof SessionConfig>(k: K, v: SessionConfig[K]) => setConfig({ ...config, [k]: v });

  return (
    <div className="stack">
      <h1>Latihan baru</h1>

      <section className="card">
        <h2>1. Bahan referensi</h2>
        <p className="muted">Tempel teks atau unggah file (PDF, Word .docx, TXT). Boleh lebih dari satu bahan.</p>

        {refs.length > 0 && (
          <ul className="refs">
            {refs.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <span className="muted small"> · {r.text.length.toLocaleString("id-ID")} karakter</span>
                  <div className="muted small clamp">{r.text.slice(0, 160)}</div>
                </div>
                <button className="btn small ghost" onClick={() => setRefs(refs.filter((x) => x.id !== r.id))}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}

        <label className="field">
          <span>Nama bahan (opsional)</span>
          <input value={pasteName} onChange={(e) => setPasteName(e.target.value)} placeholder="misalnya: SOP rilis bahan baku" />
        </label>
        <label className="field">
          <span>Teks referensi</span>
          <textarea rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Tempel teks referensi di sini…" />
        </label>
        <div className="row">
          <button className="btn" onClick={addPasted} disabled={!pasteText.trim()}>
            Tambah teks sebagai bahan
          </button>
          <label className="btn">
            Unggah file…
            <input
              type="file"
              hidden
              multiple
              accept=".pdf,.docx,.txt,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {totalChars > 0 && <p className="muted small">Total: {totalChars.toLocaleString("id-ID")} karakter dari {refs.length} bahan.</p>}
      </section>

      <section className="card">
        <h2>2. Atur latihan</h2>
        <div className="grid2">
          <label className="field">
            <span>Jenis tulisan</span>
            <select value={config.writingType} onChange={(e) => set("writingType", e.target.value as WritingType)}>
              <option value="artikel">Artikel</option>
              <option value="laporan">Laporan</option>
              <option value="esai">Esai</option>
              <option value="dokumen teknis">Dokumen teknis</option>
            </select>
          </label>
          <label className="field">
            <span>Bahasa</span>
            <select value={config.language} onChange={(e) => set("language", e.target.value as Language)}>
              <option value="id">Indonesia</option>
              <option value="en">Inggris</option>
            </select>
          </label>
          <label className="field">
            <span>Jumlah paragraf</span>
            <input
              type="number"
              min={1}
              max={10}
              value={config.paragraphCount}
              onChange={(e) => set("paragraphCount", Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            />
          </label>
          <label className="field">
            <span>Tingkat kesulitan</span>
            <select value={config.difficulty} onChange={(e) => set("difficulty", e.target.value as Difficulty)}>
              <option value="mudah">Mudah (4 kata kunci, hubungan jelas)</option>
              <option value="sedang">Sedang (5 kata kunci)</option>
              <option value="sulit">Sulit (6 kata kunci, hubungan perlu dipikirkan)</option>
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={config.examMode} onChange={(e) => set("examMode", e.target.checked)} />
          <span>
            Mode ujian: nonaktifkan tempel (paste) di kotak tulis
          </span>
        </label>
      </section>

      {error && <div className="notice error">{error}</div>}

      <div className="row end">
        <button className="btn primary" onClick={start} disabled={!!busy}>
          {busy ?? "Buat kerangka"}
        </button>
      </div>
    </div>
  );
}
