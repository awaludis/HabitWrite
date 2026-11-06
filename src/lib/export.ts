import { CRITERION_LABEL, QUALITY_CRITERIA, type Session } from "./types";

const LEVEL_LABEL = { connected: "Tersambung baik", mentioned: "Sekadar disebut", unused: "Tidak dipakai" };

/** Final writing plus its assessment, as Markdown. */
export function sessionToMarkdown(s: Session): string {
  const o = s.outline;
  if (!o) return "";
  const lines: string[] = [];
  lines.push(`# ${o.title}`, "", `_${o.goal}_`, "");
  lines.push(
    `Jenis: ${s.config.writingType} · Bahasa: ${s.config.language === "id" ? "Indonesia" : "Inggris"} · Kesulitan: ${s.config.difficulty} · Tanggal: ${new Date(s.createdAt).toLocaleString("id-ID")}`,
    "",
  );
  lines.push("## Tulisan", "");
  for (const p of s.paragraphs) {
    const last = p.attempts[p.attempts.length - 1];
    if (last) lines.push(last.text, "");
  }
  if (s.final) {
    const f = s.final;
    lines.push("## Penilaian akhir", "");
    lines.push(`**Skor akhir: ${f.adjustedScore} (${f.predicate})**`, "");
    lines.push(
      `- Rata-rata skor paragraf: ${f.averageParagraph}`,
      `- Penyesuaian kepaduan: ${f.assessment.cohesionAdjustment > 0 ? "+" : ""}${f.assessment.cohesionAdjustment}% — ${f.assessment.cohesionNote}`,
      "",
      f.assessment.summary,
      "",
      "**Kekuatan**",
      ...f.assessment.strengths.map((x) => `- ${x}`),
      "",
      "**Kelemahan**",
      ...f.assessment.weaknesses.map((x) => `- ${x}`),
      "",
    );
  }
  lines.push("## Penilaian per paragraf", "");
  s.paragraphs.forEach((p, i) => {
    const op = o.paragraphs[i];
    lines.push(`### Paragraf ${i + 1} (${op.role})`, "", `Ide pokok: ${op.mainIdea}`, "");
    p.attempts.forEach((a, k) => {
      lines.push(
        `**${k === 0 ? "Kiriman pertama" : `Revisi ${k}`}: ${a.score.total}** (kata kunci ${a.score.keywordScore}, kualitas ${a.score.qualityScore}${a.score.penaltyPct ? `, potongan revisi ${a.score.penaltyPct}%` : ""})`,
        "",
      );
    });
    const last = p.attempts[p.attempts.length - 1];
    if (!last) return;
    lines.push("| Kata kunci | Status | Alasan |", "|---|---|---|");
    for (const k of last.assessment.keywords) lines.push(`| ${k.keyword} | ${LEVEL_LABEL[k.level]} | ${k.reason} |`);
    lines.push("", "| Kriteria | Skor | Catatan |", "|---|---|---|");
    for (const c of QUALITY_CRITERIA) {
      const q = last.assessment.quality[c];
      lines.push(`| ${CRITERION_LABEL[c]} | ${q.score}/10 | ${q.note} |`);
    }
    lines.push("", `Yang sudah bagus: ${last.assessment.strength}`, "");
    if (last.copiedSentences.length) {
      lines.push("Kalimat ditandai terlalu mirip referensi (tidak dihitung):", ...last.copiedSentences.map((c) => `- ${c}`), "");
    }
  });
  return lines.join("\n");
}

export function download(filename: string, content: string, type = "text/markdown;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(s: string): string {
  return s.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "tulisan";
}
