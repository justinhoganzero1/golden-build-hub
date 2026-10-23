import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { saveBookDraft, loadBookDraft, hasBookDraftContent, sameBookDraft } from "./bookDrafts";
it("preserves manuscript text, cover, pictures and positions without sharing between members", async () => {
  const book = { title: "Private book", coverImage: "cover-data", chapters: [{ content: "Unsaved words", images: ["picture-data"], imageAnchors: [3] }] };
  await saveBookDraft("member-a", "book-1", book);
  expect(await loadBookDraft("member-a", "book-1")).toEqual(book);
  expect(await loadBookDraft("member-b", "book-1")).toBeNull();
});
it("does not offer the blank initial chapter as recovery", () => {
  expect(hasBookDraftContent({ chapters: [{ content: "" }] })).toBe(false);
  expect(hasBookDraftContent({ chapters: [{ content: "Unsaved chapter" }] })).toBe(true);
});
it("recognizes an unchanged account book despite empty optional fields", () => {
  expect(sameBookDraft({ title: "Book", chapters: [{ content: "Words" }] },
    { id: "book-1", blurb: "", title: "Book", chapters: [{ images: [], content: "Words" }] })).toBe(true);
  expect(sameBookDraft({ chapters: [{ content: "Old" }] }, { chapters: [{ content: "New" }] })).toBe(false);
});
it("keeps the offered recovery artwork while new edits continue backing up", async () => {
  const original = { coverImage: "cover", backImage: "back", chapters: [{ content: "Old", images: ["art"], imageAnchors: [2] }] };
  await saveBookDraft("member-a", "book-2:recovery", original);
  await saveBookDraft("member-a", "book-2", { ...original, chapters: [{ ...original.chapters[0], content: "New writing" }] });
  expect(await loadBookDraft("member-a", "book-2:recovery")).toEqual(original);
  expect((await loadBookDraft<typeof original>("member-a", "book-2"))?.chapters[0].content).toBe("New writing");
});