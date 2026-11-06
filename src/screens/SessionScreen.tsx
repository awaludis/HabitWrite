import { useEffect, useRef, useState } from "react";
import { Feedback, LEVEL_INFO, ScoreBadge } from "../components/Feedback";
import { AiError, assessFinal, assessParagraph, generateOutline } from "../lib/ai";
import { download, safeFilename, sessionToMarkdown } from "../lib/export";
import { computeFinal, scoreParagraph } from "../lib/scoring";
import { loadSession, saveSession, type AppSettings } from "../lib/storage";
import { countWords, detectCopied, keywordUsed } from "../lib/text";
import { CRITERION_LABEL, QUALITY_CRITERIA, type ParagraphAssessment, type Session } from "../lib/types";

const MIN_WORDS = 15;

function errMsg(e: unknown): string {
  return e instanceof AiError ? e.message : `Terjadi kesalahan: ${(e as Error).message}`;
}

export function SessionScreen({ id, settings }: { id: string; settings: AppSettings }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    loadSession(id).then((s) => setSession(s ?? null));
  }, [id]);

  if (session === undefined) return <p className="muted">Memuat…</p>;
  if (session === null)
    return (
      <div className="card">
        Sesi tidak ditemukan. <a href="#/">Kembali</a>
      </div>
    );

  const update = async (s: Session) => {
    const copy = structuredClone(s);
    await saveSession(copy);
    setSession(copy);
  };

  if (!session.outline) return <div className="card">Sesi ini belum punya kerangka. <a href="#/new">Buat latihan baru</a></div>;
  if (session.final) return <ResultView session={session} />;
  if (!session.started) return <OutlineView session={session} settings={settings} onUpdate={update} />;
  return <WriteView session={session} settings={settings} onUpdate={update} />;
}

// ---------------------------------------------------------------------------

function OutlineView({ session, settings, onUpdate }: { session: Session; settings: AppSettings; onUpdate: (s: Session) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const o = session.outline!;

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const outline = await generateOutline(settings, session.references, session.config, o);
      await onUpdate({ ...session, outline, paragraphs: outline.paragraphs.map(() => ({ draft: "", attempts: [], done: false })) });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <section className="card">
        <div className="eyebrow">Kerangka tulisan · {session.config.writingType} · {session.config.difficulty}</div>
        <h1>{o.title}</h1>
        <p><strong>Tujuan:</strong> {o.goal}</p>
      </section>
      {o.paragraphs.map((p, i) => (
        <section className="card outline-p" key={i}>
          <div className="eyebrow">Paragraf {i + 1} · {p.role}</div>
          <p><strong>Ide pokok:</strong> {p.mainIdea}</p>
          <div className="chips">
            {p.keywords.map((k) => (
              <span className="chip" key={k}>{k}</span>
            ))}
          </div>
          <p className="muted"><strong>Petunjuk:</strong> {p.hint}</p>
        </section>
      ))}
      {error && <div className="notice error">{error}</div>}
      <div className="row end">
        <button className="btn" onClick={regenerate} disabled={busy}>
          {busy ? "Membuat ulang…" : "Buat ulang kerangka"}
        </button>
        <button className="btn primary" disabled={busy} onClick={() => onUpdate({ ...session, started: true })}>
          Mulai menulis
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function WriteView({ session, settings, onUpdate }: { session: Session; settings: AppSettings; onUpdate: (s: Session) => Promise<void> }) {
  const o = session.outline!;
  const [view, setView] = useState(session.current);
  const [draft, setDraft] = useState(session.paragraphs[session.current]?.draft ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  const idx = view;
  const p = o.paragraphs[idx];
  const work = session.paragraphs[idx];
  const isCurrent = idx === session.current;
  const lastAttempt = work.attempts[work.attempts.length - 1];
  const revisionsUsed = Math.max(0, work.attempts.length - 1);
  const canRevise = isCurrent && !work.done && work.attempts.length > 0 && revisionsUsed < session.scoring.maxRevisions;
  const canSubmitFirst = isCurrent && !work.done && work.attempts.length === 0;
  const editable = canSubmitFirst || canRevise;
  const allDone = session.paragraphs.every((w) => w.done);
  const isLast = idx === o.paragraphs.length - 1;

  // Switch paragraph and its draft in one update, so nothing typed right after is overwritten.
  const goTo = (i: number, s: Session = session) => {
    setView(i);
    setDraft(s.paragraphs[i].draft || s.paragraphs[i].attempts.at(-1)?.text || "");
    setError(null);
  };

  // Autosave the draft.
  const onDraft = (v: string) => {
    setDraft(v);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const s = structuredClone(session);
      s.paragraphs[idx].draft = v;
      saveSession(s);
    }, 600);
  };

  const submit = async () => {
    window.clearTimeout(saveTimer.current);
    const text = draft.trim();
    if (countWords(text) < MIN_WORDS) return setError(`Paragraf terlalu pendek. Tulis minimal ${MIN_WORDS} kata.`);
    setError(null);
    setBusy("AI sedang menilai paragraf…");
    try {
      const refText = session.references.map((r) => r.text).join("\n\n");
      const copy = detectCopied(text, refText);
      let assessment: ParagraphAssessment;
      if (copy.kept.length === 0) {
        assessment = zeroAssessment(p.keywords);
      } else {
        assessment = await assessParagraph(settings, session, idx, copy.kept.join(" "), copy.copied);
      }
      const score = scoreParagraph(assessment, p.keywords, session.scoring, work.attempts.length);
      const s = structuredClone(session);
      s.paragraphs[idx].attempts.push({ text, copiedSentences: copy.copied, assessment, score, submittedAt: Date.now() });
      s.paragraphs[idx].draft = text;
      await onUpdate(s);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const next = async () => {
    window.clearTimeout(saveTimer.current);
    const s = structuredClone(session);
    s.paragraphs[idx].done = true;
    if (!isLast) s.current = idx + 1;
    if (!isLast) goTo(idx + 1, s);
    await onUpdate(s);
  };

  const finish = async () => {
    setBusy("AI sedang menilai tulisan secara utuh…");
    setError(null);
    try {
      const fa = await assessFinal(settings, session);
      await onUpdate({ ...session, final: computeFinal(session, fa) });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const blockPaste = (e: React.ClipboardEvent | React.DragEvent) => {
    if (!session.config.examMode) return;
    e.preventDefault();
    setPasteBlocked(true);
    setTimeout(() => setPasteBlocked(false), 2500);
  };

  // AI-judged level per keyword, from the latest attempt.
  const aiLevel = new Map(lastAttempt?.assessment.keywords.map((k) => [k.keyword.toLowerCase(), k.level]) ?? []);

  return (
    <div className="stack">
      <div className="write-head">
        <div>
          <div className="eyebrow">{o.title}</div>
          <ol className="stepper">
            {o.paragraphs.map((_, i) => {
              const w = session.paragraphs[i];
              const state = w.done ? "done" : i === session.current ? "current" : "todo";
              return (
                <li key={i}>
                  <button
                    className={`${state} ${i === view ? "viewing" : ""}`}
                    disabled={state === "todo"}
                    onClick={() => goTo(i)}
                    aria-label={`Paragraf ${i + 1}`}
                  >
                    {w.done ? "✓" : i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        {session.config.examMode && <span className="pill">Mode ujian</span>}
      </div>

      <div className="write-grid">
        <section className="card">
          <div className="eyebrow">
            Paragraf {idx + 1} dari {o.paragraphs.length} · {p.role}
          </div>
          <p><strong>Ide pokok:</strong> {p.mainIdea}</p>
          <p className="muted"><strong>Petunjuk:</strong> {p.hint}</p>

          <textarea
            className="writer"
            rows={10}
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onPaste={blockPaste}
            onDrop={blockPaste}
            readOnly={!editable || !!busy}
            placeholder={editable ? "Tulis paragraf Anda di sini…" : ""}
            spellCheck={false}
            lang={session.config.language}
          />
          <div className="row between small muted">
            <span>{countWords(draft)} kata</span>
            {pasteBlocked && <span className="warn-text">Tempel dinonaktifkan di mode ujian.</span>}
            {work.attempts.length > 0 && (
              <span>
                Revisi terpakai: {revisionsUsed}/{session.scoring.maxRevisions}
              </span>
            )}
          </div>

          {error && <div className="notice error">{error}</div>}

          <div className="row end">
            {canSubmitFirst && (
              <button className="btn primary" onClick={submit} disabled={!!busy}>
                {busy ?? "Kirim paragraf"}
              </button>
            )}
            {canRevise && (
              <button className="btn" onClick={submit} disabled={!!busy || draft.trim() === lastAttempt?.text}>
                {busy ?? `Kirim revisi${session.scoring.revisionPenaltyPct ? ` (−${session.scoring.revisionPenaltyPct}%)` : ""}`}
              </button>
            )}
            {isCurrent && !work.done && work.attempts.length > 0 && (
              <button className="btn primary" onClick={next} disabled={!!busy}>
                {isLast ? "Selesai menulis" : "Lanjut ke paragraf berikutnya"}
              </button>
            )}
            {allDone && (
              <button className="btn primary" onClick={finish} disabled={!!busy}>
                {busy ?? "Lihat penilaian akhir"}
              </button>
            )}
          </div>
        </section>

        <aside className="card keywords">
          <h3>Kata kunci</h3>
          <ul>
            {p.keywords.map((k) => {
              const used = keywordUsed(k, draft);
              const level = aiLevel.get(k.toLowerCase());
              return (
                <li key={k} className={used ? "used" : ""}>
                  <span className="tick" aria-label={used ? "terdeteksi" : "belum dipakai"}>{used ? "✓" : ""}</span>
                  <span>{k}</span>
                  {level && <span className={`lv ${LEVEL_INFO[level].cls}`} title={LEVEL_INFO[level].label}>{LEVEL_INFO[level].icon}</span>}
                </li>
              );
            })}
          </ul>
          <p className="muted small">
            Centang muncul saat kata kunci (atau bentuk berimbuhannya) terdeteksi. Nilai tertinggi didapat bila kata kunci
            disambungkan menjadi satu rantai gagasan, bukan sekadar disebut.
          </p>
        </aside>
      </div>

      {lastAttempt && (
        <section className="card">
          <h2>Umpan balik</h2>
          <Feedback attempt={lastAttempt} attempts={work.attempts} scoring={session.scoring} />
        </section>
      )}
    </div>
  );
}

function zeroAssessment(keywords: string[]): ParagraphAssessment {
  const note = "Semua kalimat terlalu mirip bahan referensi sehingga tidak dihitung.";
  const q = { score: 0, note };
  return {
    keywords: keywords.map((k) => ({ keyword: k, level: "unused", reason: "Kalimat yang memuatnya disalin dari referensi." })),
    longestChain: [],
    quality: { mainIdea: q, coherence: q, clarity: q, grammar: q, accuracy: q },
    strength: "–",
    improvements: [{ sentence: "", issue: "Tulis ulang gagasan dengan kalimat Anda sendiri, jangan menyalin dari referensi." }],
    guidingQuestions: ["Bagaimana Anda menjelaskan gagasan ini kepada rekan kerja dengan kata-kata sendiri?"],
  };
}

// ---------------------------------------------------------------------------

function ResultView({ session }: { session: Session }) {
  const f = session.final!;
  const o = session.outline!;
  const [open, setOpen] = useState<number | null>(null);
  const adj = f.assessment.cohesionAdjustment;

  return (
    <div className="stack">
      <section className="card result-hero">
        <div className="eyebrow">Penilaian akhir</div>
        <h1>{o.title}</h1>
        <div className="big-score">
          <ScoreBadge value={f.adjustedScore} />
          <div>
            <div className="predicate">{f.predicate}</div>
            <div className="muted small">
              Rata-rata paragraf {f.averageParagraph} · kepaduan {adj > 0 ? "+" : ""}
              {adj}%
            </div>
          </div>
        </div>
        <p>{f.assessment.summary}</p>
        <p className="muted small">{f.assessment.cohesionNote}</p>
      </section>

      <div className="grid2">
        <section className="card">
          <h3>Kekuatan</h3>
          <ul>{f.assessment.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </section>
        <section className="card">
          <h3>Kelemahan / fokus berikutnya</h3>
          <ul>{f.assessment.weaknesses.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </section>
      </div>

      <section className="card">
        <h3>Rata-rata per kriteria</h3>
        <table className="criteria">
          <tbody>
            <tr>
              <th>Pemakaian kata kunci</th>
              <td className="num">{Math.round(f.avgKeywordPct)}%</td>
            </tr>
            {QUALITY_CRITERIA.map((c) => (
              <tr key={c}>
                <th>{CRITERION_LABEL[c]}</th>
                <td className="num">{f.criteriaAvg[c]}/10</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>Tulisan Anda</h3>
        {session.paragraphs.map((w, i) => {
          const last = w.attempts.at(-1)!;
          return (
            <div key={i} className="final-p">
              <div className="row between">
                <span className="eyebrow">Paragraf {i + 1} · {o.paragraphs[i].role}</span>
                <span>
                  <ScoreBadge value={last.score.total} />
                  {w.attempts.length > 1 && <span className="muted small"> (awal {w.attempts[0].score.total})</span>}
                </span>
              </div>
              <p>{last.text}</p>
              <button className="btn small ghost" onClick={() => setOpen(open === i ? null : i)}>
                {open === i ? "Tutup rincian" : "Lihat rincian"}
              </button>
              {open === i && <Feedback attempt={last} attempts={w.attempts} scoring={session.scoring} />}
            </div>
          );
        })}
      </section>

      <div className="row end">
        <a className="btn" href="#/">Kembali ke beranda</a>
        <button className="btn primary" onClick={() => download(`${safeFilename(o.title)}.md`, sessionToMarkdown(session))}>
          Unduh tulisan & penilaian
        </button>
      </div>
    </div>
  );
}
