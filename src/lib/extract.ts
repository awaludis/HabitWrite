/** Extract plain text from uploaded reference files (TXT/MD, PDF, DOCX), entirely in the browser. */

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return extractPdf(file);
  if (name.endsWith(".docx")) return extractDocx(file);
  if (name.endsWith(".doc")) throw new Error("Format .doc lama belum didukung. Simpan ulang sebagai .docx.");
  return (await file.text()).trim();
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else if (!line.endsWith(" ")) line += " ";
    }
    if (line.trim()) lines.push(line);
    pages.push(lines.join("\n"));
  }
  const text = pages.join("\n\n").replace(/[ \t]+/g, " ").trim();
  if (!text) throw new Error("PDF tidak berisi teks (mungkin hasil pindaian). Tempel teksnya secara manual.");
  return text;
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value.trim();
}
