import { describe, it, expect } from "vitest";
import { wantsTextInImage, textsMatch, cleanTexts, exactTextInstruction } from "../../supabase/functions/image-gen/textCheck";

describe("words in Oracle pictures", () => {
  it("spots requests that want words drawn in the picture", () => {
    expect(wantsTextInImage('A poster that says "Happy Birthday Mum"')).toBe(true);
    expect(wantsTextInImage("a birthday card for Sarah")).toBe(true);
    expect(wantsTextInImage("a sunset over the ocean")).toBe(false);
    expect(wantsTextInImage('a shop sign, no text')).toBe(false);
  });

  it("only passes when every word reads back correctly", () => {
    expect(textsMatch(["Happy Birthday Mum"], ["HAPPY BIRTHDAY", "MUM!"])).toBe(true);
    expect(textsMatch(["Happy Birthday Mum"], ["HAPPY BRITHDAY MUM"])).toBe(false);
    expect(textsMatch([], ["anything"])).toBe(true);
  });

  it("pins the corrected wording into the picture request", () => {
    expect(cleanTexts(["  Beach   Closed ", 3, ""])).toEqual(["Beach Closed"]);
    expect(exactTextInstruction(["Beach Closed"])).toContain('"Beach Closed"');
  });
});
