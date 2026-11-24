import { describe, it, expect } from "vitest";
import { parseChatGPTExport, parseGeminiActivityJson, parseGeminiActivityHtml, wantedZipEntry, toImportRows, guessSource, htmlToText } from "./chatHistoryImport";

const chatgpt = [{
  id: "c1", title: "Fishing trip", create_time: 1700000000, current_node: "n4",
  mapping: {
    root: { id: "root", parent: null, message: null },
    n1: { id: "n1", parent: "root", message: { author: { role: "system" }, content: { content_type: "text", parts: ["sys"] } } },
    n2: { id: "n2", parent: "n1", message: { author: { role: "user" }, create_time: 1700000010, content: { content_type: "text", parts: ["Best bait for bream?"] } } },
    old: { id: "old", parent: "n2", message: { author: { role: "assistant" }, content: { content_type: "text", parts: ["discarded branch"] } } },
    n3: { id: "n3", parent: "n2", message: { author: { role: "assistant" }, create_time: 1700000020, content: { content_type: "text", parts: ["Prawns work well."] } } },
    n4: { id: "n4", parent: "n3", message: { author: { role: "tool" }, content: { content_type: "text", parts: ["tool output"] } } },
  },
}];

describe("ChatGPT export", () => {
  it("keeps only the user's and ChatGPT's words on the branch they last saw", () => {
    const [c] = parseChatGPTExport(chatgpt);
    expect(c.title).toBe("Fishing trip");
    expect(c.messages.map(m => [m.role, m.content])).toEqual([["user", "Best bait for bream?"], ["assistant", "Prawns work well."]]);
    expect(c.messages[0].sentAt).toBe(new Date(1700000010 * 1000).toISOString());
  });
});

describe("Gemini export", () => {
  it("reads prompts and replies from the JSON file and groups them by day", () => {
    const convs = parseGeminiActivityJson([
      { header: "Gemini Apps", title: "Prompted What is a lamington?", time: "2025-03-01T10:00:00.000Z", safeHtmlItem: [{ html: "<p>A sponge cake &amp; coconut.</p>" }] },
      { header: "Gemini Apps", title: "Used Gemini Apps", time: "2025-03-01T10:05:00.000Z" },
      { header: "Gemini Apps", title: "Prompted Recipe please", time: "2025-03-01T11:00:00.000Z", safeHtmlItem: [{ html: "<ul><li>Eggs</li></ul>" }] },
    ]);
    expect(convs).toHaveLength(1);
    expect(convs[0].id).toBe("gemini-2025-03-01");
    expect(convs[0].messages.map(m => m.content)).toEqual(["What is a lamington?", "A sponge cake & coconut.", "Recipe please", "• Eggs"]);
  });

  it("reads the default HTML file", () => {
    const html = `<div class="outer-cell mdl-cell"><div class="mdl-grid"><div class="header-cell"><p>Gemini Apps</p></div><div class="content-cell mdl-cell">Prompted&nbsp;How tall is Uluru?<br>Mar 2, 2025, 9:15:00 AM AEST<br><p>About 348 metres.</p></div><div class="content-cell mdl-cell mdl-typography--caption">Products: Gemini Apps</div></div></div>`;
    const [c] = parseGeminiActivityHtml(html);
    expect(c.messages.map(m => [m.role, m.content])).toEqual([["user", "How tall is Uluru?"], ["assistant", "About 348 metres."]]);
  });
});

describe("export files and rows", () => {
  it("picks the right files out of the ZIPs", () => {
    expect(wantedZipEntry("conversations.json")).toBe("chatgpt");
    expect(wantedZipEntry("Takeout/My Activity/Gemini Apps/MyActivity.html")).toBe("gemini");
    expect(wantedZipEntry("Takeout/My Activity/YouTube/MyActivity.html")).toBeNull();
    expect(wantedZipEntry("chat.html")).toBeNull();
  });
  it("recognises a picked file", () => {
    expect(guessSource("conversations.json", JSON.stringify(chatgpt))).toBe("chatgpt");
    expect(guessSource("MyActivity.json", '[{"header":"Gemini Apps","title":"Prompted hi"}]')).toBe("gemini");
  });
  it("caps a huge export", () => {
    const rows = toImportRows("u1", "chatgpt", parseChatGPTExport(chatgpt), 1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: "u1", source: "chatgpt", conversation_id: "c1", msg_index: 0, role: "user" });
  });
  it("turns reply HTML into plain words", () => {
    expect(htmlToText("Line one<br>Line &#39;two&#39;")).toBe("Line one\nLine 'two'");
  });
});
