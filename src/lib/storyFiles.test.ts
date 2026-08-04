import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildStoryFile, buildTxtBlob, buildHtmlBlob, STORY_FILE_META } from "./storyFiles";
import { splitForNarration, storyNarrationScript } from "./storyNarration";

const story = {
  title: "Scam The Scammer",
  author: "Justin Hogan",
  genre: "Thriller",
  premise: "A con artist meets his match.",
  blurb: "The blurb goes here.",
  chapters: [
    { title: "Chapter 1", content: "First line.\n\nSecond paragraph is here." },
    { title: "Chapter 2", content: "More story. ".repeat(50) },
    { title: "Empty", content: "   " },
  ],
};

const buf = (b: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(b);
  });
const bytes = async (b: Blob) => new Uint8Array(await buf(b));
const asText = async (b: Blob) => new TextDecoder().decode(await bytes(b));

describe("story file exports", () => {
  it("txt contains the whole story and skips empty chapters", async () => {
    const text = await asText(buildTxtBlob(story));
    expect(text).toContain("Scam The Scammer");
    expect(text).toContain("Second paragraph is here.");
    expect(text).not.toContain("Empty");
  });

  it("html is a complete document", async () => {
    const html = await asText(buildHtmlBlob(story));
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<h2>Chapter 2</h2>");
  });

  it("epub is a valid zip with mimetype, opf and chapters", async () => {
    const file = await buildStoryFile(story, "epub");
    expect(file.name.endsWith(".epub")).toBe(true);
    expect(file.type).toBe(STORY_FILE_META.epub.mime);
    const zip = await JSZip.loadAsync(await buf(file));
    expect(await zip.file("mimetype")!.async("string")).toBe("application/epub+zip");
    expect(zip.file("META-INF/container.xml")).toBeTruthy();
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain("<dc:title>Scam The Scammer</dc:title>");
    expect(zip.file("OEBPS/chapter-002.xhtml")).toBeTruthy();
    expect(zip.file("OEBPS/chapter-003.xhtml")).toBeFalsy();
  });

  it("pdf starts with the PDF magic header", async () => {
    const file = await buildStoryFile(story, "pdf");
    const head = new TextDecoder().decode((await bytes(file)).slice(0, 5));
    expect(head).toBe("%PDF-");
  });
});

describe("narration chunking", () => {
  it("never exceeds the provider limit and keeps all text", () => {
    const script = storyNarrationScript(story as any);
    const chunks = splitForNarration(script, 200);
    expect(chunks.every((c) => c.length <= 200)).toBe(true);
    expect(chunks.join("").replace(/\s+/g, "")).toBe(script.replace(/\s+/g, ""));
  });

  it("includes opening and closing credits", () => {
    const script = storyNarrationScript(story as any);
    expect(script).toContain("By Justin Hogan");
    expect(script).toContain("Thank you for listening");
  });
});
