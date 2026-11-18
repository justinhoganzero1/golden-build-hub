import { describe, it, expect } from "vitest";
import {
  NO_REPEAT_MARKER,
  withNoRepeatRule,
  addNoRepeatRuleToBody,
  removeRepeatedSentences,
} from "../../supabase/functions/_shared/noRepeat";

describe("no-repeat rule", () => {
  it("adds the rule to the system message of a text request", () => {
    const out = withNoRepeatRule([{ role: "system", content: "Be kind." }, { role: "user", content: "hi" }]);
    expect(String(out[0].content)).toContain("Be kind.");
    expect(String(out[0].content)).toContain(NO_REPEAT_MARKER);
  });

  it("adds a system message when a request has none", () => {
    const out = withNoRepeatRule([{ role: "user", content: "tell me a story" }]);
    expect(out[0].role).toBe("system");
    expect(String(out[0].content)).toContain(NO_REPEAT_MARKER);
  });

  it("adds the rule only once", () => {
    const once = withNoRepeatRule([{ role: "system", content: "x" }]);
    const twice = withNoRepeatRule(once);
    expect(String(twice[0].content).split(NO_REPEAT_MARKER).length - 1).toBe(1);
  });

  it("leaves picture-making requests alone", () => {
    const raw = JSON.stringify({ modalities: ["image", "text"], messages: [{ role: "user", content: "a cat" }] });
    expect(addNoRepeatRuleToBody(raw)).toBe(raw);
  });

  it("removes a description that is repeated word for word", () => {
    const text = "The old lighthouse leaned against the grey sky. Mia walked in.\nThe old lighthouse leaned against the grey sky! She smiled.";
    const out = removeRepeatedSentences(text);
    expect(out.match(/old lighthouse/g)?.length).toBe(1);
    expect(out).toContain("Mia walked in.");
    expect(out).toContain("She smiled.");
  });

  it("removes a joke told a second time", () => {
    const text = "Why did the moon skip dinner? Because it was full. Anyway. Why did the moon skip dinner? Because it was full.";
    const out = removeRepeatedSentences(text);
    expect(out.match(/skip dinner/g)?.length).toBe(1);
  });

  it("keeps short everyday lines like Yes. that can naturally repeat", () => {
    expect(removeRepeatedSentences("Yes. I agree. Yes.")).toBe("Yes. I agree. Yes.");
  });
});

describe("no-repeat backstop safety", () => {
  it("never changes JSON answers", () => {
    const json = '{"a":"The old lighthouse leaned against the grey sky.","b":"The old lighthouse leaned against the grey sky."}';
    expect(removeRepeatedSentences(json)).toBe(json);
  });
});

describe("no-repeat inside dialogue", () => {
  it("drops a joke repeated in quotes after a different lead-in", () => {
    const text = 'She whispered, "Why did the moon skip dinner? Because it was full."\nShe smiled. "Why did the moon skip dinner? Because it was full."';
    const out = removeRepeatedSentences(text);
    expect(out.match(/skip dinner/g)?.length).toBe(1);
    expect(out.match(/it was full/g)?.length).toBe(1);
    expect(out).toContain("She smiled.");
  });
});
