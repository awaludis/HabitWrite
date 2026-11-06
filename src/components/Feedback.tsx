import { CRITERION_LABEL, QUALITY_CRITERIA, type Attempt, type KeywordLevel, type ScoringSettings } from "../lib/types";

export const LEVEL_INFO: Record<KeywordLevel, { label: string; icon: string; cls: string }> = {
  connected: { label: "Tersambung baik", icon: "●", cls: "lv-good" },
  mentioned: { label: "Sekadar disebut", icon: "◐", cls: "lv-mid" },
  unused: { label: "Tidak dipakai", icon: "○", cls: "lv-none" },
};

export function ScoreBadge({ value, max = 100 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  const cls = pct >= 75 ? "good" : pct >= 60 ? "mid" : "low";
  return <span className={`score ${cls}`}>{value}</span>;
}

export function Feedback({ attempt, attempts, scoring }: { attempt: Attempt; attempts: Attempt[]; scoring: ScoringSettings }) {
  const { assessment: a, score } = attempt;
  const qWeight = 100 - scoring.keywordWeight;
  return (
    <div className="feedback">
      <div className="scoreline">
        <div>
          <div className="muted small">Skor paragraf</div>
          <ScoreBadge value={score.total} />
          <span className="muted"> / 100</span>
        </div>
        <div>
          <div className="muted small">Kata kunci</div>
          <strong>{score.keywordScore}</strong>
          <span className="muted"> / {scoring.keywordWeight}</span>
          <div className="muted small">
            dasar {score.keywordBase}/40 + bonus sambungan {score.chainBonus}/10
          </div>
        </div>
        <div>
          <div className="muted small">Kualitas</div>
          <strong>{score.qualityScore}</strong>
          <span className="muted"> / {qWeight}</span>
        </div>
        {score.penaltyPct > 0 && (
          <div>
            <div className="muted small">Potongan revisi</div>
            <strong>−{score.penaltyPct}%</strong>
            <div className="muted small">dari {score.rawTotal}</div>
          </div>
        )}
      </div>

      {attempts.length > 1 && (
        <p className="small">
          Perkembangan:{" "}
          {attempts.map((x, i) => (
            <span key={i}>
              {i > 0 && " → "}
              {i === 0 ? "awal" : `revisi ${i}`} <strong>{x.score.total}</strong>
            </span>
          ))}
        </p>
      )}

      {attempt.copiedSentences.length > 0 && (
        <div className="notice warn">
          <strong>Kalimat terlalu mirip bahan referensi</strong> (tidak dihitung untuk skor):
          <ul>
            {attempt.copiedSentences.map((c, i) => (
              <li key={i}>
                <mark>{c}</mark>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h4>Status kata kunci</h4>
      <ul className="kw-status">
        {a.keywords.map((k) => (
          <li key={k.keyword}>
            <span className={`lv ${LEVEL_INFO[k.level].cls}`}>
              {LEVEL_INFO[k.level].icon} {LEVEL_INFO[k.level].label}
            </span>
            <strong>{k.keyword}</strong>
            <span className="muted"> — {k.reason}</span>
          </li>
        ))}
      </ul>
      {a.longestChain.length >= 3 && (
        <p className="small">
          Rantai gagasan terpanjang: <strong>{a.longestChain.join(" → ")}</strong>
        </p>
      )}

      <h4>Kualitas paragraf</h4>
      <table className="criteria">
        <tbody>
          {QUALITY_CRITERIA.map((c) => (
            <tr key={c}>
              <th>{CRITERION_LABEL[c]}</th>
              <td className="num">
                <ScoreBadge value={a.quality[c].score} max={10} />
                <span className="muted">/10</span>
              </td>
              <td>{a.quality[c].note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Yang sudah bagus</h4>
      <p>{a.strength}</p>

      {a.improvements.length > 0 && (
        <>
          <h4>Perlu diperbaiki</h4>
          <ul>
            {a.improvements.map((imp, i) => (
              <li key={i}>
                {imp.sentence && <q className="quote">{imp.sentence}</q>} {imp.issue}
              </li>
            ))}
          </ul>
        </>
      )}

      {a.guidingQuestions.length > 0 && (
        <>
          <h4>Pertanyaan pemandu</h4>
          <ul className="questions">
            {a.guidingQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
