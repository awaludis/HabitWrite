import { describe, expect, it } from "vitest";
import { detectCopied, keywordUsed } from "../src/lib/text";

describe("keywordUsed", () => {
  it("matches Indonesian affixed forms", () => {
    expect(keywordUsed("kelola", "Pengelolaan gudang dilakukan setiap hari.")).toBe(true);
    expect(keywordUsed("kelola", "Gudang dikelola oleh tim QC.")).toBe(true);
    expect(keywordUsed("kelola", "Tim QC mengelola gudang.")).toBe(true);
    expect(keywordUsed("tulis", "Ia menulis laporan.")).toBe(true);
    expect(keywordUsed("pakai", "Bahan yang dipakai dan pemakaiannya.")).toBe(true);
    expect(keywordUsed("susun", "Mereka menyusun jadwal.")).toBe(true);
  });
  it("matches multi-word phrases", () => {
    expect(keywordUsed("waktu rilis", "Risiko tinggi memperpanjang waktu rilis bahan.")).toBe(true);
    expect(keywordUsed("histori mutu", "Histori mutunya baik.")).toBe(true);
    expect(keywordUsed("waktu rilis", "Waktu yang dibutuhkan untuk rilis lama.")).toBe(false);
  });
  it("matches English inflections", () => {
    expect(keywordUsed("supplier", "Two suppliers were audited.")).toBe(true);
    expect(keywordUsed("evaluate", "The material was evaluated twice.")).toBe(true);
  });
  it("does not match unrelated words", () => {
    expect(keywordUsed("risiko", "Pemasok mengirim bahan tepat waktu.")).toBe(false);
  });
});

describe("detectCopied", () => {
  const ref = "Tingkat evaluasi bahan baku ditentukan oleh risiko pemasok dan histori mutu selama dua tahun terakhir.";
  it("flags sentences copied from the reference", () => {
    const r = detectCopied(
      "Tingkat evaluasi bahan baku ditentukan oleh risiko pemasok dan histori mutu. Menurut saya ini membuat QC bekerja lebih terarah.",
      ref,
    );
    expect(r.copied).toHaveLength(1);
    expect(r.kept).toHaveLength(1);
  });
  it("keeps original sentences", () => {
    const r = detectCopied("Semakin tinggi risiko pemasok, semakin dalam pula pemeriksaan yang dilakukan QC sebelum rilis.", ref);
    expect(r.copied).toHaveLength(0);
  });
});
