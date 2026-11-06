/** Text utilities: tokenizing, light stemming (Indonesian + English), keyword detection, copy detection. */

export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) ?? []);
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=[^\s])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

const ID_SUFFIXES = ["nya", "lah", "kah", "kan", "an", "i"];
const MIN_ROOT = 3;

/** Remove Indonesian prefixes, including nasal assimilation (meN-/peN-). Returns possible roots. */
function stripIdPrefix(w: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    if (s.length >= MIN_ROOT) out.push(s);
  };
  const vowel = (c: string | undefined) => !!c && "aiueo".includes(c);

  for (const p of ["me", "pe"]) {
    if (!w.startsWith(p)) continue;
    const r = w.slice(p.length);
    if (r.startsWith("ng")) {
      const rest = r.slice(2);
      add(rest); // mengambil → ambil, menggali → gali
      if (vowel(rest[0])) add("k" + rest); // mengelola → kelola
    } else if (r.startsWith("ny")) {
      add("s" + r.slice(2)); // menyusun → susun
    } else if (r.startsWith("m")) {
      const rest = r.slice(1);
      add(rest); // membuat → buat
      if (vowel(rest[0])) add("p" + rest); // memakai → pakai
    } else if (r.startsWith("n")) {
      const rest = r.slice(1);
      add(rest); // mendapat → dapat
      if (vowel(rest[0])) add("t" + rest); // menulis → tulis
    } else {
      add(r); // melihat → lihat, perapian handled below
    }
  }
  for (const p of ["di", "ter", "ber", "per", "ke", "se", "be", "te"]) {
    if (w.startsWith(p)) add(w.slice(p.length));
  }
  return out;
}

function stripIdSuffix(w: string): string[] {
  const out: string[] = [];
  for (const s of ID_SUFFIXES) {
    if (w.endsWith(s) && w.length - s.length >= MIN_ROOT) out.push(w.slice(0, -s.length));
  }
  return out;
}

function stripEnSuffix(w: string): string[] {
  const out: string[] = [];
  const rules: [string, string[]][] = [
    ["ies", ["y"]],
    ["ing", ["", "e"]],
    ["ed", ["", "e"]],
    ["es", [""]],
    ["s", [""]],
    ["ly", [""]],
    ["ment", [""]],
    ["ation", ["e", ""]],
    ["ion", ["e", ""]],
    ["er", ["", "e"]],
    ["ity", ["e", ""]],
  ];
  for (const [suf, reps] of rules) {
    if (w.endsWith(suf) && w.length - suf.length >= MIN_ROOT) {
      for (const r of reps) out.push(w.slice(0, -suf.length) + r);
    }
  }
  return out;
}

const stemCache = new Map<string, Set<string>>();

/** All plausible base forms of a word (the word itself included). */
export function wordForms(word: string): Set<string> {
  const w = word.toLowerCase();
  const cached = stemCache.get(w);
  if (cached) return cached;
  const forms = new Set<string>([w]);
  let frontier = [w];
  for (let depth = 0; depth < 3; depth++) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const c of [...stripIdSuffix(f), ...stripIdPrefix(f), ...stripEnSuffix(f)]) {
        if (!forms.has(c)) {
          forms.add(c);
          next.push(c);
        }
      }
    }
    frontier = next;
  }
  stemCache.set(w, forms);
  return forms;
}

function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const fa = wordForms(a);
  const fb = wordForms(b);
  // Compare roots only (original word, or derived forms of length >= 4) to limit false positives.
  for (const x of fa) if (x.length >= 4 && fb.has(x)) return true;
  return false;
}

/** True if the keyword (single word or phrase) appears in the text, allowing affixed forms. */
export function keywordUsed(keyword: string, text: string): boolean {
  const kw = tokenize(keyword);
  if (kw.length === 0) return false;
  const tokens = tokenize(text);
  outer: for (let i = 0; i + kw.length <= tokens.length; i++) {
    for (let j = 0; j < kw.length; j++) {
      if (!sameWord(kw[j], tokens[i + j])) continue outer;
    }
    return true;
  }
  return false;
}

export function countWords(text: string): number {
  return tokenize(text).length;
}

function shingles(tokens: string[], n: number): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) s.add(tokens.slice(i, i + n).join(" "));
  return s;
}

export interface CopyCheck {
  copied: string[];
  kept: string[];
}

/**
 * Flags sentences that are too similar to the reference material.
 * A sentence is "copied" when at least half of its word 4-grams appear in the reference
 * (or, for short sentences, when the whole sentence appears verbatim).
 */
export function detectCopied(text: string, reference: string, threshold = 0.5): CopyCheck {
  const refTokens = tokenize(reference);
  const ref4 = shingles(refTokens, 4);
  const refJoined = " " + refTokens.join(" ") + " ";
  const copied: string[] = [];
  const kept: string[] = [];
  for (const sentence of splitSentences(text)) {
    const t = tokenize(sentence);
    let isCopy = false;
    if (t.length >= 6) {
      const s4 = shingles(t, 4);
      let hit = 0;
      for (const g of s4) if (ref4.has(g)) hit++;
      isCopy = s4.size > 0 && hit / s4.size >= threshold;
    } else if (t.length >= 4) {
      isCopy = refJoined.includes(" " + t.join(" ") + " ");
    }
    (isCopy ? copied : kept).push(sentence);
  }
  return { copied, kept };
}
