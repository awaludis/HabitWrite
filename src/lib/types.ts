export type WritingType = "artikel" | "laporan" | "esai" | "dokumen teknis";
export type Language = "id" | "en";
export type Difficulty = "mudah" | "sedang" | "sulit";
export type ParagraphRole = "pendahuluan" | "isi" | "penutup";
export type KeywordLevel = "connected" | "mentioned" | "unused";

export interface ReferenceMaterial {
  id: string;
  name: string;
  text: string;
}

export interface SessionConfig {
  writingType: WritingType;
  language: Language;
  paragraphCount: number;
  difficulty: Difficulty;
  examMode: boolean;
}

export interface OutlineParagraph {
  role: ParagraphRole;
  mainIdea: string;
  keywords: string[];
  hint: string;
  /** Expected keyword chain, kept internally for grading and never shown to the user. */
  expectedLinks: string;
}

export interface Outline {
  title: string;
  goal: string;
  paragraphs: OutlineParagraph[];
}

export interface KeywordAssessment {
  keyword: string;
  level: KeywordLevel;
  reason: string;
}

export interface CriterionScore {
  score: number; // 0–10
  note: string;
}

export const QUALITY_CRITERIA = ["mainIdea", "coherence", "clarity", "grammar", "accuracy"] as const;
export type QualityCriterion = (typeof QUALITY_CRITERIA)[number];

export const CRITERION_LABEL: Record<QualityCriterion, string> = {
  mainIdea: "Kesesuaian ide pokok",
  coherence: "Kepaduan",
  clarity: "Kejelasan",
  grammar: "Kaidah bahasa",
  accuracy: "Ketepatan isi",
};

export interface ParagraphAssessment {
  keywords: KeywordAssessment[];
  /** Longest chain of keywords that form one complete idea, as judged by the AI. */
  longestChain: string[];
  quality: Record<QualityCriterion, CriterionScore>;
  strength: string;
  improvements: { sentence: string; issue: string }[];
  guidingQuestions: string[];
}

/** Scores computed by app code from an assessment (never invented by the AI). */
export interface ParagraphScore {
  keywordBase: number; // 0–40 scale before weighting
  chainBonus: number; // 0–10 scale before weighting
  keywordScore: number; // weighted, 0–keywordWeight
  qualityScore: number; // weighted, 0–(100-keywordWeight)
  rawTotal: number; // 0–100 before revision penalty
  penaltyPct: number;
  total: number; // final paragraph score
}

export interface Attempt {
  text: string;
  /** Sentences removed from scoring because they are too similar to the reference. */
  copiedSentences: string[];
  assessment: ParagraphAssessment;
  score: ParagraphScore;
  submittedAt: number;
}

export interface ParagraphWork {
  draft: string;
  attempts: Attempt[]; // attempts[0] = first submission, then revisions
  done: boolean;
}

export interface FinalAssessment {
  cohesionAdjustment: number; // -10..10 (percent)
  cohesionNote: string;
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

export interface FinalResult {
  averageParagraph: number;
  adjustedScore: number;
  predicate: string;
  avgKeywordPct: number;
  avgQualityPct: number;
  criteriaAvg: Record<QualityCriterion, number>;
  assessment: FinalAssessment;
}

export interface ScoringSettings {
  keywordWeight: number; // 0–100, quality = 100 - keywordWeight
  revisionPenaltyPct: number; // per revision
  maxRevisions: number;
}

export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  references: ReferenceMaterial[];
  config: SessionConfig;
  scoring: ScoringSettings; // snapshot at session start, so history stays consistent
  outline?: Outline;
  paragraphs: ParagraphWork[];
  current: number;
  started?: boolean;
  final?: FinalResult;
}
