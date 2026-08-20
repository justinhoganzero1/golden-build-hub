// Complete-file builders for a story: EPUB3, PDF, plain text, HTML.
// Used by Story Writer exports AND the share dialog so whatever the user sends
// is a real, openable file — not a link back into the app.
import JSZip from "jszip";

export interface StoryChapter {
  title: string;
  content: string;
  images?: string[];
  /** Paragraph index each illustration should follow, parallel to `images`. */
  imageAnchors?: number[];
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
figure.plate{margin:2.5rem 0;page-break-before:always;page-break-after:always;}
figure.plate img{width:100%;border-radius:12px;}
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

/**
 * EPUB3 — validated against Amazon KDP / Send to Kindle requirements.
 * Includes: Kindle-safe CSS, title page, copyright page, EPUB3 nav + landmarks,
 * legacy NCX (Kindle's converter still reads it), cover-image properties,
 * reflowable metadata and a guide element.
 */
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
  const uuid = crypto.randomUUID();
  const bookId = `urn:uuid:${uuid}`;
  const title = xmlEscape(story.title || "Untitled");
  const author = xmlEscape(story.author || "Anonymous");
  const now = new Date().toISOString().split(".")[0] + "Z";
  const year = new Date().getFullYear();

  // Kindle-safe stylesheet: no fixed pixel fonts, no absolute positioning.
  oebps.file(
    "style.css",
    `body{margin:0;padding:0;font-family:serif;line-height:1.5;text-align:left;}
h1{font-size:1.6em;margin:1em 0 .6em;text-align:center;page-break-before:always;}
h1.first{page-break-before:avoid;}
p{margin:0;text-indent:1.2em;}
p.first{text-indent:0;margin-top:.6em;}
p.center{text-indent:0;text-align:center;margin:.5em 0;}
.titlepage{text-align:center;margin-top:20%;}
.titlepage h1{font-size:2em;page-break-before:avoid;}
.titlepage .author{font-size:1.1em;font-style:italic;margin-top:1em;}
.copyright{font-size:.85em;text-align:center;margin-top:12%;}
img{max-width:100%;height:auto;}
figure{margin:0;padding:0;text-align:center;page-break-before:always;page-break-after:always;page-break-inside:avoid;}
figure img{max-width:100%;max-height:96vh;height:auto;}`,
  );

  let coverManifest = "";
  let coverSpine = "";
  let coverMeta = "";
  let coverGuide = "";
  const cover = story.coverImage ? dataUrlToBytes(story.coverImage) : null;
  if (cover) {
    oebps.file(`cover.${cover.ext}`, cover.bytes);
    oebps.file(
      "cover.xhtml",
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Cover</title>
<link rel="stylesheet" type="text/css" href="style.css"/></head>
<body epub:type="cover"><div style="text-align:center;"><img src="cover.${cover.ext}" alt="${title} cover"/></div></body></html>`,
    );
    coverManifest = `<item id="cover-image" href="cover.${cover.ext}" media-type="${cover.mime}" properties="cover-image"/>
<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`;
    coverSpine = `<itemref idref="cover" linear="yes"/>`;
    coverMeta = `<meta name="cover" content="cover-image"/>`;
    coverGuide = `<reference type="cover" title="Cover" href="cover.xhtml"/>`;
  }

  // Front matter — KDP expects a title page and a copyright page.
  oebps.file(
    "titlepage.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${title}</title>
<link rel="stylesheet" type="text/css" href="style.css"/></head>
<body epub:type="titlepage"><div class="titlepage"><h1>${title}</h1>
<p class="author">${author}</p></div></body></html>`,
  );
  oebps.file(
    "copyright.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Copyright</title>
<link rel="stylesheet" type="text/css" href="style.css"/></head>
<body epub:type="copyright-page"><div class="copyright">
<p class="center">${title}</p>
<p class="center">Copyright &#169; ${year} ${author}</p>
<p class="center">All rights reserved.</p>
<p class="center">This is a work of fiction. Names, characters, places and incidents are the product of the author's imagination or are used fictitiously.</p>
<p class="center">Produced with AI assistance and reviewed by the author. Created with Oracle Lunar.</p>
</div></body></html>`,
  );

  const chapters = nonEmptyChapters(story);
  const imageManifest: string[] = [];
  const chapterFiles = chapters.map((c, i) => {
    const fname = `chapter-${String(i + 1).padStart(3, "0")}.xhtml`;
    const imgTags: string[] = [];
    const imgAnchors: (number | undefined)[] = [];
    (c.images || []).forEach((img, k) => {
      const parsed = img ? dataUrlToBytes(img) : null;
      if (!parsed) return;
      const iname = `img-${i + 1}-${k + 1}.${parsed.ext}`;
      oebps.file(iname, parsed.bytes);
      imageManifest.push(`<item id="img${i + 1}_${k + 1}" href="${iname}" media-type="${parsed.mime}"/>`);
      imgTags.push(`<figure class="plate"><img src="${iname}" alt="Full-page illustration"/></figure>`);
      imgAnchors.push(c.imageAnchors?.[k]);
    });
    const paras = c.content
      .split(/\n{2,}/)
      .map((p, pi) => `<p${pi === 0 ? ' class="first"' : ""}>${xmlEscape(p).replace(/\n/g, "<br/>")}</p>`);
    // Place each illustration at the paragraph the AI anchored it to; fall back
    // to an even spread for older stories with no anchors.
    const body: string[] = [];
    const hasAnchors = imgAnchors.some((a) => typeof a === "number");
    if (hasAnchors) {
      const resolved = imgTags.map((tag, k) => ({
        tag,
        at: Math.max(0, Math.min(paras.length, imgAnchors[k] ?? Math.round(((k + 1) / (imgTags.length + 1)) * paras.length))),
      })).sort((a, b) => a.at - b.at);
      let next = 0;
      paras.forEach((p, idx) => {
        while (next < resolved.length && resolved[next].at <= idx) body.push(resolved[next++].tag);
        body.push(p);
      });
      while (next < resolved.length) body.push(resolved[next++].tag);
    } else {
      const every = imgTags.length ? Math.max(1, Math.floor(paras.length / (imgTags.length + 1))) : 0;
      let placed = 0;
      paras.forEach((p, idx) => {
        body.push(p);
        if (every && placed < imgTags.length && (idx + 1) % every === 0) body.push(imgTags[placed++]);
      });
      while (placed < imgTags.length) body.push(imgTags[placed++]);
    }
    oebps.file(
      fname,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${xmlEscape(c.title || "Chapter")}</title>
<link rel="stylesheet" type="text/css" href="style.css"/></head>
<body epub:type="bodymatter"><h1${i === 0 ? ' class="first"' : ""}>${xmlEscape(c.title || "Chapter")}</h1>${body.join("\n")}</body></html>`,
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
<head><title>Table of Contents</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${navPoints}</ol></nav>
<nav epub:type="landmarks" hidden="hidden"><ol>
${cover ? `<li><a epub:type="cover" href="cover.xhtml">Cover</a></li>` : ""}
<li><a epub:type="titlepage" href="titlepage.xhtml">Title Page</a></li>
<li><a epub:type="bodymatter" href="${chapterFiles[0]?.fname || "titlepage.xhtml"}">Start Reading</a></li>
</ol></nav></body></html>`,
  );

  // Legacy NCX — Kindle's KindleGen/Kindle Previewer path still prefers it.
  const ncxPoints = [
    { src: "titlepage.xhtml", label: "Title Page" },
    ...chapterFiles.map((c) => ({ src: c.fname, label: c.title })),
  ]
    .map(
      (p, i) =>
        `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${xmlEscape(p.label)}</text></navLabel><content src="${p.src}"/></navPoint>`,
    )
    .join("\n");
  oebps.file(
    "toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${title}</text></docTitle>
  <docAuthor><text>${author}</text></docAuthor>
  <navMap>${ncxPoints}</navMap>
</ncx>`,
  );

  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en" prefix="rendition: http://www.idpf.org/vocab/rendition/#">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator id="creator">${author}</dc:creator>
    <meta refines="#creator" property="role" scheme="marc:relators">aut</meta>
    <meta refines="#creator" property="file-as">${author}</meta>
    <dc:language>en</dc:language>
    <dc:date>${now}</dc:date>
    <dc:publisher>${author}</dc:publisher>
    <dc:rights>Copyright &#169; ${year} ${author}. All rights reserved.</dc:rights>
    <dc:description>${xmlEscape(story.blurb || story.premise || "")}</dc:description>
    <dc:subject>${xmlEscape(story.genre || "")}</dc:subject>
    <meta property="dcterms:modified">${now}</meta>
    <meta property="rendition:layout">reflowable</meta>
    <meta property="rendition:spread">auto</meta>
    ${coverMeta}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>
    <item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/>
    ${coverManifest}
    ${imageManifest.join("\n")}
    ${manifestItems}
  </manifest>
  <spine toc="ncx" page-progression-direction="ltr">
    ${coverSpine}
    <itemref idref="titlepage" linear="yes"/>
    <itemref idref="copyright" linear="yes"/>
    <itemref idref="nav" linear="yes"/>
    ${spineItems}
  </spine>
  <guide>
    ${coverGuide}
    <reference type="title-page" title="Title Page" href="titlepage.xhtml"/>
    <reference type="toc" title="Contents" href="nav.xhtml"/>
    <reference type="text" title="Start Reading" href="${chapterFiles[0]?.fname || "titlepage.xhtml"}"/>
  </guide>
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
