import {
  QUALITY_CRITERIA,
  type FinalAssessment,
  type FinalResult,
  type KeywordLevel,
  type ParagraphAssessment,
  type ParagraphScore,
  type QualityCriterion,
  type ScoringSettings,
  type Session,
} from "./types";

export const DEFAULT_SCORING: ScoringSettings = {
  keywordWeight: 50,
  revisionPenaltyPct: 5,
  maxRevisions: 2,
};

export const LEVEL_POINTS: Record<KeywordLevel, number> = { connected: 2, mentioned: 1, unused: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Chain bonus (0–10): given only when 3+ keywords form one connected chain.
 * Grows linearly from 3 linked keywords up to all keywords linked.
 */
export function chainBonus(chainLength: number, keywordCount: number): number {
  if (chainLength < 3) return 0;
  const span = Math.max(keywordCount, 3) - 2;
  return 10 * Math.min(1, (chainLength - 2) / span);
}

export function scoreParagraph(
  assessment: ParagraphAssessment,
  keywords: string[],
  scoring: ScoringSettings,
  revisionIndex: number,
): ParagraphScore {
  const n = keywords.length || 1;
  const levelOf = new Map<string, KeywordLevel>();
  for (const k of assessment.keywords) levelOf.set(k.keyword.trim().toLowerCase(), k.level);

  let points = 0;
  for (const kw of keywords) points += LEVEL_POINTS[levelOf.get(kw.trim().toLowerCase()) ?? "unused"];
  const keywordBase = (points / (2 * n)) * 40;

  // Only count chain members that are real keywords judged "connected".
  const chain = new Set(
    assessment.longestChain
      .map((c) => c.trim().toLowerCase())
      .filter((c) => levelOf.get(c) === "connected" && keywords.some((k) => k.toLowerCase() === c)),
  );
  const bonus = chainBonus(chain.size, keywords.length);

  const kw = clamp(scoring.keywordWeight, 0, 100);
  const keywordScore = ((keywordBase + bonus) / 50) * kw;
  const qualitySum = QUALITY_CRITERIA.reduce((s, c) => s + clamp(assessment.quality[c]?.score ?? 0, 0, 10), 0);
  const qualityScore = (qualitySum / 50) * (100 - kw);
  const rawTotal = keywordScore + qualityScore;
  const penaltyPct = clamp(revisionIndex * scoring.revisionPenaltyPct, 0, 100);
  const total = rawTotal * (1 - penaltyPct / 100);

  return {
    keywordBase: round1(keywordBase),
    chainBonus: round1(bonus),
    keywordScore: round1(keywordScore),
    qualityScore: round1(qualityScore),
    rawTotal: round1(rawTotal),
    penaltyPct,
    total: round1(total),
  };
}

export function predicate(score: number): string {
  if (score >= 90) return "Sangat baik";
  if (score >= 75) return "Baik";
  if (score >= 60) return "Cukup";
  return "Perlu latihan";
}

export function computeFinal(session: Session, assessment: FinalAssessment): FinalResult {
  const finals = session.paragraphs.map((p) => p.attempts[p.attempts.length - 1]).filter(Boolean);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const averageParagraph = mean(finals.map((a) => a.score.total));
  const adj = clamp(assessment.cohesionAdjustment, -10, 10);
  const adjustedScore = clamp(averageParagraph * (1 + adj / 100), 0, 100);

  // Progress metrics as percentages so sessions with different weights stay comparable.
  const avgKeywordPct = mean(finals.map((a) => ((a.score.keywordBase + a.score.chainBonus) / 50) * 100));
  const avgQualityPct = mean(
    finals.map((a) => (QUALITY_CRITERIA.reduce((s, c) => s + clamp(a.assessment.quality[c].score, 0, 10), 0) / 50) * 100),
  );
  const criteriaAvg = Object.fromEntries(
    QUALITY_CRITERIA.map((c) => [c, round1(mean(finals.map((a) => clamp(a.assessment.quality[c].score, 0, 10))))]),
  ) as Record<QualityCriterion, number>;

  return {
    averageParagraph: round1(averageParagraph),
    adjustedScore: round1(adjustedScore),
    predicate: predicate(adjustedScore),
    avgKeywordPct: round1(avgKeywordPct),
    avgQualityPct: round1(avgQualityPct),
    criteriaAvg,
    assessment: { ...assessment, cohesionAdjustment: adj },
  };
}

/** Criteria with the lowest average across finished sessions, weakest first. */
export function weakestCriteria(sessions: Session[]): { criterion: QualityCriterion; avg: number }[] {
  const done = sessions.filter((s) => s.final);
  if (!done.length) return [];
  return QUALITY_CRITERIA.map((c) => ({
    criterion: c,
    avg: round1(done.reduce((s, x) => s + x.final!.criteriaAvg[c], 0) / done.length),
  })).sort((a, b) => a.avg - b.avg);
}
