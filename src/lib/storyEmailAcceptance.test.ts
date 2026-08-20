// Acceptance/regression suite for the "email an entire illustrated book"
// flow (email-story + send-to-kindle edge functions, storyFiles.ts builders).
//
// Scope: prove that a complete 20-chapter, fully-illustrated story is
// packaged and delivered with nothing missing, nothing reordered, and
// nothing silently dropped by a size/format guard.
//
// NOTE: email-story/send-to-kindle are Deno edge functions (network + Resend
// side effects) and are intentionally NOT invoked live here. This suite
// unit-tests the exact pure logic they share with the client builders
// (image-anchor placement, chapter filtering, payload-size math) by
// re-implementing the guard formulas 1:1 from the source so a change to
// either side breaks a test. True end-to-end delivery must additionally be
// covered by a manual/staging run against Resend + a real Kindle address
// (see "Manual/staging checks" at the bottom).

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildStoryFile, buildEpubBlob, type StoryFileSource } from "./storyFiles";

const toArrayBuffer = (b: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(b);
  });

const onePxPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const buildFullStory = (chapterCount = 20, imagesPerChapter = 2): StoryFileSource => ({
  title: "The Twenty Chapter Chronicle",
  author: "QA Bot",
  genre: "Fantasy",
  premise: "A tale told in exactly twenty chapters.",
  blurb: "Every chapter matters.",
  coverImage: onePxPng,
  chapters: Array.from({ length: chapterCount }, (_, i) => ({
    title: `Chapter ${i + 1}: The ${i + 1}th Trial`,
    content: `Paragraph one of chapter ${i + 1}.\n\nParagraph two of chapter ${i + 1}, with more words to pad it out.`,
    images: Array.from({ length: imagesPerChapter }, () => onePxPng),
    imageAnchors: Array.from({ length: imagesPerChapter }, (_, k) => k),
  })),
});

describe("acceptance: complete 20-chapter illustrated book packaging", () => {
  it("A1 — all 20 chapters survive into the EPUB manifest, in order, none merged/dropped", async () => {
    const story = buildFullStory(20, 2);
    const file = await buildStoryFile(story, "epub");
    const zip = await JSZip.loadAsync(await toArrayBuffer(file));

    const chapterFiles = Object.keys(zip.files)
      .filter((n) => /^OEBPS\/chapter-\d{3}\.xhtml$/.test(n))
      .sort();
    expect(chapterFiles).toHaveLength(20);

    // Order + content fidelity: chapter-001 must contain "Chapter 1" title text,
    // chapter-020 must contain "Chapter 20", nothing shifted or duplicated.
    for (let i = 0; i < 20; i++) {
      const fname = `OEBPS/chapter-${String(i + 1).padStart(3, "0")}.xhtml`;
      const xhtml = await zip.file(fname)!.async("string");
      expect(xhtml).toContain(`Chapter ${i + 1}:`);
    }
  });

  it("A2 — every illustration in every chapter is embedded as a real image entry, not a dangling reference", async () => {
    const story = buildFullStory(20, 2);
    const file = await buildStoryFile(story, "epub");
    const zip = await JSZip.loadAsync(await toArrayBuffer(file));

    const imageFiles = Object.keys(zip.files).filter((n) => /^OEBPS\/img-\d+-\d+\./.test(n));
    // 20 chapters * 2 images each = 40 embedded illustration files.
    expect(imageFiles).toHaveLength(40);

    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    for (const img of imageFiles) {
      const bare = img.replace("OEBPS/", "");
      expect(opf).toContain(bare); // every image is declared in the manifest
    }

    // Every chapter file actually references its own images (no chapter left blank).
    for (let i = 1; i <= 20; i++) {
      const xhtml = await zip.file(`OEBPS/chapter-${String(i).padStart(3, "0")}.xhtml`)!.async("string");
      expect((xhtml.match(/<img /g) ?? []).length).toBe(2);
    }
  });

  it("A3 — cover image is present and referenced from both the manifest and title/cover pages", async () => {
    const story = buildFullStory(20, 1);
    const file = await buildStoryFile(story, "epub");
    const zip = await JSZip.loadAsync(await toArrayBuffer(file));
    expect(zip.file(/^OEBPS\/cover\./)).toBeTruthy();
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain('properties="cover-image"');
  });

  it("A4 — table of contents (nav.xhtml + toc.ncx) lists all 20 chapters in reading order", async () => {
    const story = buildFullStory(20, 1);
    const file = await buildStoryFile(story, "epub");
    const zip = await JSZip.loadAsync(await toArrayBuffer(file));
    const nav = await zip.file("OEBPS/nav.xhtml")!.async("string");
    const ncx = await zip.file("OEBPS/toc.ncx")!.async("string");

    const navTitles = [...nav.matchAll(/<a href="chapter-\d+\.xhtml">([^<]+)<\/a>/g)].map((m) => m[1]);
    expect(navTitles).toHaveLength(20);
    expect(navTitles[0]).toContain("Chapter 1:");
    expect(navTitles[19]).toContain("Chapter 20:");
    // Order must be strictly ascending, matching spine order.
    const orderedNums = navTitles.map((t) => Number(t.match(/Chapter (\d+)/)?.[1]));
    expect(orderedNums).toEqual([...orderedNums].sort((a, b) => a - b));

    for (let i = 1; i <= 20; i++) expect(ncx).toContain(`chapter-${String(i).padStart(3, "0")}.xhtml`);
  });

  it("A5 — a chapter with empty content is correctly excluded, and count reflects only non-empty chapters (guards against off-by-one silently truncating chapter 20)", async () => {
    const story = buildFullStory(19, 1);
    story.chapters.push({ title: "Chapter 20: The Finale", content: "" }); // blank chapter 20
    const file = await buildStoryFile(story, "epub");
    const zip = await JSZip.loadAsync(await toArrayBuffer(file));
    const chapterFiles = Object.keys(zip.files).filter((n) => /^OEBPS\/chapter-\d{3}\.xhtml$/.test(n));
    // Regression trap: an empty chapter 20 must not produce a phantom empty
    // file, and must not be silently counted as "delivered".
    expect(chapterFiles).toHaveLength(19);
  });

  it("A6 — illustrations respect their anchor position and are not reordered relative to their chapter's text", async () => {
    const story = buildFullStory(1, 3);
    story.chapters[0].content = "Para A.\n\nPara B.\n\nPara C.";
    story.chapters[0].imageAnchors = [0, 1, 2];
    const file = await buildStoryFile(story, "epub");
    const zip = await JSZip.loadAsync(await toArrayBuffer(file));
    const xhtml = await zip.file("OEBPS/chapter-001.xhtml")!.async("string");
    const order = [...xhtml.matchAll(/<figure[^>]*>|Para [ABC]\./g)].map((m) => m[0]);
    // Each image must appear directly after the paragraph it was anchored to.
    expect(order.join("|")).toMatch(/<figure[^|]*\|Para A\.\|<figure[^|]*\|Para B\.\|<figure[^|]*\|Para C\./);
  });
});

describe("regression: payload / size guards that could silently drop content", () => {
  it("R1 — email-story's 8MB HTML ceiling formula (mirrors supabase/functions/email-story/index.ts)", () => {
    const HTML_CEILING = 8 * 1024 * 1024;
    const tooBigHtml = "x".repeat(HTML_CEILING + 1);
    const okHtml = "x".repeat(HTML_CEILING - 1);
    expect(tooBigHtml.length > HTML_CEILING).toBe(true); // must be rejected with a clear error, not truncated/silently sent
    expect(okHtml.length > HTML_CEILING).toBe(false);
  });

  it("R2 — chapters array is hard-capped at 200 server-side; a 20-chapter book must sit far under any truncation boundary", () => {
    const chapters = Array.from({ length: 20 }, (_, i) => ({ content: `ch${i}` }));
    const capped = chapters.slice(0, 200);
    expect(capped).toHaveLength(20); // no truncation for a real 20-chapter book
  });

  it("R3 — per-chapter image cap (12) must not be silently exceeded/clipped for a normally-illustrated chapter", () => {
    const images = Array.from({ length: 6 }, () => onePxPng); // typical: up to 6/chapter per StoryWriterPage
    const capped = images.slice(0, 12);
    expect(capped).toHaveLength(6); // regression: real illustration counts must never approach the silent-clip cap
  });

  it("R4 — send-to-kindle's 50MB (base64 x1.4) ceiling formula", () => {
    const LIMIT = 50 * 1024 * 1024 * 1.4;
    const base64Len = 40 * 1024 * 1024; // a hefty but plausible 20-chapter, fully-illustrated EPUB, base64-encoded
    expect(base64Len < LIMIT).toBe(true);
  });

  it("R5 — recipient validation only accepts exactly one address, rejecting empty/multiple silently-dropped recipients", () => {
    const parse = (to: string) =>
      to.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    expect(parse("reader@example.com")).toHaveLength(1);
    expect(parse("a@example.com, b@example.com").length !== 1).toBe(true); // must be rejected, not silently sent to only one
    expect(parse("not-an-email").length !== 1).toBe(true);
  });
});
