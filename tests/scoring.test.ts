import { describe, expect, it } from "vitest";
import { chainBonus, computeFinal, predicate, scoreParagraph } from "../src/lib/scoring";
import type { ParagraphAssessment, Session } from "../src/lib/types";

const q = (score: number) => ({ score, note: "" });
const kws = ["risiko", "tingkat evaluasi", "pemasok", "histori mutu", "waktu rilis"];

function assessment(levels: ("connected" | "mentioned" | "unused")[], chain: string[], quality = 8): ParagraphAssessment {
  return {
    keywords: kws.map((k, i) => ({ keyword: k, level: levels[i], reason: "" })),
    longestChain: chain,
    quality: { mainIdea: q(quality), coherence: q(quality), clarity: q(quality), grammar: q(quality), accuracy: q(quality) },
    strength: "",
    improvements: [],
    guidingQuestions: [],
  };
}
const scoring = { keywordWeight: 50, revisionPenaltyPct: 5, maxRevisions: 2 };

describe("scoreParagraph", () => {
  it("gives full marks for all keywords chained and perfect quality", () => {
    const s = scoreParagraph(assessment(Array(5).fill("connected"), kws, 10), kws, scoring, 0);
    expect(s.keywordBase).toBe(40);
    expect(s.chainBonus).toBe(10);
    expect(s.total).toBe(100);
  });
  it("scores mentioned keywords at half points and no bonus without a 3-chain", () => {
    const s = scoreParagraph(assessment(Array(5).fill("mentioned"), [], 5), kws, scoring, 0);
    expect(s.keywordBase).toBe(20);
    expect(s.chainBonus).toBe(0);
    expect(s.keywordScore).toBe(20);
    expect(s.qualityScore).toBe(25);
    expect(s.total).toBe(45);
  });
  it("ignores chain members that are not 'connected'", () => {
    const s = scoreParagraph(
      assessment(["connected", "connected", "mentioned", "unused", "unused"], ["risiko", "tingkat evaluasi", "pemasok"]),
      kws,
      scoring,
      0,
    );
    expect(s.chainBonus).toBe(0);
  });
  it("applies the revision penalty per revision", () => {
    const a = assessment(Array(5).fill("connected"), kws, 10);
    expect(scoreParagraph(a, kws, scoring, 1).total).toBe(95);
    expect(scoreParagraph(a, kws, scoring, 2).total).toBe(90);
  });
  it("respects custom weights", () => {
    const s = scoreParagraph(assessment(Array(5).fill("connected"), kws, 5), kws, { ...scoring, keywordWeight: 60 }, 0);
    expect(s.keywordScore).toBe(60);
    expect(s.qualityScore).toBe(20);
  });
});

describe("chainBonus", () => {
  it("grows with chain length", () => {
    expect(chainBonus(2, 5)).toBe(0);
    expect(chainBonus(3, 5)).toBeCloseTo(3.33, 1);
    expect(chainBonus(5, 5)).toBe(10);
    expect(chainBonus(3, 3)).toBe(10);
  });
});

describe("final score", () => {
  it("adjusts the average by the cohesion percentage and assigns a predicate", () => {
    const a = assessment(Array(5).fill("connected"), kws, 6);
    const score = scoreParagraph(a, kws, scoring, 0); // 50 + 30 = 80
    const session = {
      paragraphs: [{ draft: "", done: true, attempts: [{ text: "", copiedSentences: [], assessment: a, score, submittedAt: 0 }] }],
    } as unknown as Session;
    const f = computeFinal(session, { cohesionAdjustment: 10, cohesionNote: "", strengths: [], weaknesses: [], summary: "" });
    expect(f.averageParagraph).toBe(80);
    expect(f.adjustedScore).toBe(88);
    expect(f.predicate).toBe("Baik");
    expect(predicate(59.9)).toBe("Perlu latihan");
    expect(predicate(90)).toBe("Sangat baik");
  });
});
