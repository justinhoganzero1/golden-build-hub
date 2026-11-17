import { describe, it, expect } from "vitest";
import { clipText, readableKind, documentHtml } from "./fileText";
describe("fileText", () => {
  it("knows which files can be read", () => {
    expect(readableKind("cv.pdf", "")).toBe("pdf");
    expect(readableKind("cv.docx", "")).toBe("docx");
    expect(readableKind("notes.txt", "text/plain")).toBe("text");
    expect(readableKind("me.jpg", "image/jpeg")).toBeNull();
  });
  it("cuts very long text to 15000 characters", () => {
    expect(clipText("a".repeat(20000)).length).toBeLessThan(15020);
  });
  it("turns headings and bullets into a page", () => {
    const html = documentHtml("CV", "# Jane\n## Experience\n- Built <things>");
    expect(html).toContain("<h1>Jane</h1>");
    expect(html).toContain("<li>Built &lt;things&gt;</li>");
  });
});
