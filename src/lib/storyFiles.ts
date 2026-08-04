// Complete-file builders for a story: EPUB3, PDF, plain text, HTML.
// Used by Story Writer exports AND the share dialog so whatever the user sends
// is a real, openable file — not a link back into the app.
import JSZip from "jszip";

export interface StoryChapter {
  title: string;
  content: string;
  images?: string[];
}

export interface StoryFileSource {
  title: string;
  author?: string;
  genre?: string;
  premise?: string;
  blurb?: string;
  coverImage?: string;
  chapters: StoryChapter[];
}

export const slugifyStory = (s: string) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "story";

const xmlEscape = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const dataUrlToBytes = (dataUrl: string): { bytes: Uint8Array; mime: string; ext: string } | null => {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl || "");
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = m[1].split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
  return { bytes, mime: m[1], ext };
};

const nonEmptyChapters = (story: StoryFileSource) =>
  (story.chapters || []).filter((c) => (c?.content || "").trim().length > 0);

/** Plain text — universally openable, great for SMS/email/notes apps. */
export const buildTxtBlob = (story: StoryFileSource): Blob => {
  const lines: string[] = [
    story.title || "Untitled Story",
    story.author ? `by ${story.author}` : "",
    story.genre ? `Genre: ${story.genre}` : "",
    "",
    (story.blurb || story.premise || "").trim(),
    "",
    "".padEnd(60, "="),
    "",
  ];
  for (const c of nonEmptyChapters(story)) {
    lines.push(c.title || "Chapter", "", c.content.trim(), "", "".padEnd(60, "-"), "");
  }
  lines.push("", "Created with Oracle Lunar — https://oracle-lunar.online");
  return new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
};

/** Self-contained HTML — opens in any browser, keeps the cover image. */
export const buildHtmlBlob = (story: StoryFileSource): Blob => {
  const chapters = nonEmptyChapters(story)
    .map(
      (c) =>
        `<section><h2>${xmlEscape(c.title || "Chapter")}</h2>${c.content
          .split(/\n{2,}/)
          .map((p) => `<p>${xmlEscape(p).replace(/\n/g, "<br/>")}</p>`)
          .join("")}</section>`,
    )
    .join("\n");
  const cover = story.coverImage?.startsWith("data:image/")
    ? `<img class="cover" src="${story.coverImage}" alt="${xmlEscape(story.title)} cover"/>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${xmlEscape(story.title || "Untitled Story")}</title>
<style>
body{margin:0;background:#0b0b12;color:#f4efe6;font:17px/1.7 Georgia,serif;}
main{max-width:44rem;margin:0 auto;padding:3rem 1.25rem 5rem;}
h1{font-size:2.4rem;line-height:1.15;margin:0 0 .25rem;color:#f7d488;}
.by{color:#c8bfae;margin:0 0 2rem;font-style:italic;}
.cover{width:100%;border-radius:14px;margin:0 0 2rem;}
h2{margin:3rem 0 1rem;font-size:1.5rem;color:#f7d488;border-bottom:1px solid #33303c;padding-bottom:.4rem;}
.blurb{border-left:3px solid #f7d488;padding-left:1rem;color:#d8d0c2;font-style:italic;}
footer{margin-top:4rem;text-align:center;color:#8d8678;font-size:.85rem;}
a{color:#f7d488;}
</style></head><body><main>
${cover}
<h1>${xmlEscape(story.title || "Untitled Story")}</h1>
${story.author ? `<p class="by">by ${xmlEscape(story.author)}</p>` : ""}
${story.blurb || story.premise ? `<p class="blurb">${xmlEscape(story.blurb || story.premise || "")}</p>` : ""}
${chapters}
<footer>Created with Oracle Lunar — <a href="https://oracle-lunar.online">oracle-lunar.online</a></footer>
</main></body></html>`;
  return new Blob([html], { type: "text/html;charset=utf-8" });
};

/** EPUB3 — accepted by Kindle/KDP, Kobo, Apple Books, Google Play Books. */
export const buildEpubBlob = async (story: StoryFileSource): Promise<Blob> => {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.folder("META-INF")!.file(
    "container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );

  const oebps = zip.folder("OEBPS")!;
  const bookId = `urn:uuid:${crypto.randomUUID()}`;
  const title = xmlEscape(story.title || "Untitled");
  const author = xmlEscape(story.author || "Anonymous");
  const now = new Date().toISOString().split(".")[0] + "Z";

  let coverManifest = "";
  let coverSpine = "";
  let coverMeta = "";
  const cover = story.coverImage ? dataUrlToBytes(story.coverImage) : null;
  if (cover) {
    oebps.file(`cover.${cover.ext}`, cover.bytes);
    oebps.file(
      "cover.xhtml",
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Cover</title></head>
<body><div style="text-align:center;"><img src="cover.${cover.ext}" alt="Cover" style="max-width:100%;"/></div></body></html>`,
    );
    coverManifest = `<item id="cover-image" href="cover.${cover.ext}" media-type="${cover.mime}" properties="cover-image"/>
<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`;
    coverSpine = `<itemref idref="cover" linear="yes"/>`;
    coverMeta = `<meta name="cover" content="cover-image"/>`;
  }

  const chapters = nonEmptyChapters(story);
  const imageManifest: string[] = [];
  const chapterFiles = chapters.map((c, i) => {
    const fname = `chapter-${String(i + 1).padStart(3, "0")}.xhtml`;
    const imgTags: string[] = [];
    (c.images || []).forEach((img, k) => {
      const parsed = img ? dataUrlToBytes(img) : null;
      if (!parsed) return;
      const iname = `img-${i + 1}-${k + 1}.${parsed.ext}`;
      oebps.file(iname, parsed.bytes);
      imageManifest.push(`<item id="img${i + 1}_${k + 1}" href="${iname}" media-type="${parsed.mime}"/>`);
      imgTags.push(`<div style="text-align:center;margin:1.5em 0;"><img src="${iname}" alt="Illustration" style="max-width:100%;"/></div>`);
    });
    const paras = c.content
      .split(/\n{2,}/)
      .map((p) => `<p>${xmlEscape(p).replace(/\n/g, "<br/>")}</p>`);
    // Spread illustrations evenly through the chapter.
    const body: string[] = [];
    const every = imgTags.length ? Math.max(1, Math.floor(paras.length / (imgTags.length + 1))) : 0;
    let placed = 0;
    paras.forEach((p, idx) => {
      body.push(p);
      if (every && placed < imgTags.length && (idx + 1) % every === 0) body.push(imgTags[placed++]);
    });
    while (placed < imgTags.length) body.push(imgTags[placed++]);
    oebps.file(
      fname,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xmlEscape(c.title || "Chapter")}</title></head>
<body><h1>${xmlEscape(c.title || "Chapter")}</h1>${body.join("\n")}</body></html>`,
    );
    return { fname, title: c.title || `Chapter ${i + 1}`, id: `ch${i + 1}` };
  });

  const manifestItems = chapterFiles
    .map((c) => `<item id="${c.id}" href="${c.fname}" media-type="application/xhtml+xml"/>`)
    .join("\n");
  const spineItems = chapterFiles.map((c) => `<itemref idref="${c.id}"/>`).join("\n");
  const navPoints = chapterFiles.map((c) => `<li><a href="${c.fname}">${xmlEscape(c.title)}</a></li>`).join("\n");

  oebps.file(
    "nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title></head>
<body><nav epub:type="toc"><h1>Contents</h1><ol>${navPoints}</ol></nav></body></html>`,
  );

  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>en</dc:language>
    <dc:description>${xmlEscape(story.blurb || story.premise || "")}</dc:description>
    <dc:subject>${xmlEscape(story.genre || "")}</dc:subject>
    <meta property="dcterms:modified">${now}</meta>
    ${coverMeta}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${coverManifest}
    ${imageManifest.join("\n")}
    ${manifestItems}
  </manifest>
  <spine>
    ${coverSpine}
    ${spineItems}
  </spine>
</package>`,
  );

  return zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
};

/** PDF — the safest "everyone can open it" format. */
export const buildPdfBlob = async (story: StoryFileSource): Promise<Blob> => {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxW = pageW - margin * 2;
  let y = margin;

  const newPage = () => { doc.addPage(); y = margin; };
  const ensure = (h: number) => { if (y + h > pageH - margin) newPage(); };

  if (story.coverImage?.startsWith("data:image/")) {
    try {
      const fmt = /png/i.test(story.coverImage.slice(0, 30)) ? "PNG" : "JPEG";
      doc.addImage(story.coverImage, fmt, margin, margin, maxW, pageH - margin * 2, undefined, "FAST");
      newPage();
    } catch { /* cover optional */ }
  }

  doc.setFont("times", "bold");
  doc.setFontSize(26);
  const titleLines = doc.splitTextToSize(story.title || "Untitled Story", maxW);
  ensure(titleLines.length * 30);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 30 + 6;

  if (story.author) {
    doc.setFont("times", "italic");
    doc.setFontSize(13);
    doc.text(`by ${story.author}`, margin, y);
    y += 26;
  }

  const intro = (story.blurb || story.premise || "").trim();
  if (intro) {
    doc.setFont("times", "italic");
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(intro, maxW);
    for (const line of lines) { ensure(16); doc.text(line, margin, y); y += 16; }
    y += 12;
  }

  for (const c of nonEmptyChapters(story)) {
    newPage();
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    const hl = doc.splitTextToSize(c.title || "Chapter", maxW);
    doc.text(hl, margin, y);
    y += hl.length * 22 + 8;

    doc.setFont("times", "normal");
    doc.setFontSize(12);
    for (const para of c.content.split(/\n{2,}/)) {
      const lines = doc.splitTextToSize(para.trim(), maxW);
      for (const line of lines) { ensure(16); doc.text(line, margin, y); y += 16; }
      y += 8;
    }
  }

  doc.setFont("times", "italic");
  doc.setFontSize(10);
  ensure(20);
  doc.text("Created with Oracle Lunar — oracle-lunar.online", margin, pageH - 30);

  return doc.output("blob");
};

export type StoryFileFormat = "epub" | "pdf" | "txt" | "html";

export const STORY_FILE_META: Record<StoryFileFormat, { label: string; ext: string; mime: string; hint: string }> = {
  epub: { label: "EPUB (e-reader)", ext: "epub", mime: "application/epub+zip", hint: "Kindle, Kobo, Apple Books" },
  pdf: { label: "PDF", ext: "pdf", mime: "application/pdf", hint: "Opens on every device" },
  txt: { label: "Plain text", ext: "txt", mime: "text/plain", hint: "Tiny, always works" },
  html: { label: "Web page", ext: "html", mime: "text/html", hint: "Styled, keeps the cover" },
};

export const buildStoryFile = async (
  story: StoryFileSource,
  format: StoryFileFormat,
): Promise<File> => {
  const meta = STORY_FILE_META[format];
  let blob: Blob;
  switch (format) {
    case "epub": blob = await buildEpubBlob(story); break;
    case "pdf": blob = await buildPdfBlob(story); break;
    case "html": blob = buildHtmlBlob(story); break;
    default: blob = buildTxtBlob(story);
  }
  return new File([blob], `${slugifyStory(story.title)}.${meta.ext}`, { type: meta.mime });
};

export const downloadFile = (file: File | Blob, filename?: string) => {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || (file as File).name || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

/** Share real files through the OS share sheet; falls back to a download. */
export const shareFiles = async (
  files: File[],
  meta: { title: string; text?: string },
): Promise<"shared" | "downloaded" | "cancelled"> => {
  const nav: any = typeof navigator !== "undefined" ? navigator : null;
  if (nav?.canShare?.({ files }) && nav.share) {
    try {
      await nav.share({ files, title: meta.title, text: meta.text });
      return "shared";
    } catch (e: any) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  files.forEach((f) => downloadFile(f));
  return "downloaded";
};
