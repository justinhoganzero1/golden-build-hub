import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { saveBookDraft, loadBookDraft } from "./bookDrafts";
it("preserves manuscript text, cover, pictures and positions without sharing between members", async () => {
  const book = { title: "Private book", coverImage: "cover-data", chapters: [{ content: "Unsaved words", images: ["picture-data"], imageAnchors: [3] }] };
  await saveBookDraft("member-a", "book-1", book);
  expect(await loadBookDraft("member-a", "book-1")).toEqual(book);
  expect(await loadBookDraft("member-b", "book-1")).toBeNull();
});