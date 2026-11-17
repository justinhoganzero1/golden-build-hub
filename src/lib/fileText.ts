/** Reads the words inside an attached file so Oracle can use them (CVs, notes, job ads). */
export const MAX_FILE_TEXT = 15000;

export function clipText(text: string, max = MAX_FILE_TEXT): string {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return clean.length > max ? `${clean.slice(0, max)}\n…[cut short]` : clean;
}

export function readableKind(name: string, type: string): "pdf" | "docx" | "text" | null {
  const n = name.toLowerCase();
  if (type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx") || type.includes("wordprocessingml")) return "docx";
  if (type.startsWith("text/") || /\.(txt|md|csv|json|rtf)$/.test(n)) return "text";
  return null;
}

export async function extractFileText(file: File): Promise<string | null> {
  const kind = readableKind(file.name, file.type);
  if (!kind) return null;
  try {
    if (kind === "text") return clipText(await file.text());
    if (kind === "docx") {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return clipText(value);
    }
    const pdfjs = await import("pdfjs-dist");
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it: any) => ("str" in it ? it.str : "")).join(" "));
    }
    return clipText(pages.join("\n\n"));
  } catch (e) {
    console.warn("Could not read file text", e);
    return null;
  }
}

/** Turns Oracle's markdown document into a clean printable page. */
export function documentHtml(title: string, markdown: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  const out: string[] = [];
  let list = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)/.exec(line);
    if (!bullet && list) { out.push("</ul>"); list = false; }
    if (!line) continue;
    if (bullet) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(bullet[1])}</li>`); continue; }
    const h = /^(#{1,3})\s+(.*)/.exec(line);
    if (h) { const l = h[1].length; out.push(`<h${l}>${inline(h[2])}</h${l}>`); continue; }
    if (/^-{3,}$/.test(line)) { out.push("<hr>"); continue; }
    out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push("</ul>");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:Georgia,'Times New Roman',serif;max-width:780px;margin:32px auto;padding:0 24px;color:#1a1a1a;line-height:1.5}h1{font-size:28px;margin:0 0 4px;border-bottom:2px solid #b8892b;padding-bottom:6px}h2{font-size:18px;text-transform:uppercase;letter-spacing:.06em;color:#7a5a17;margin:22px 0 6px}h3{font-size:16px;margin:12px 0 2px}p{margin:4px 0}ul{margin:4px 0 8px 20px;padding:0}hr{border:0;border-top:1px solid #ddd}@page{size:A4;margin:14mm}</style></head><body>${out.join("\n")}</body></html>`;
}
