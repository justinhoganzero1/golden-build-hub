import { describe, it, expect } from "vitest";
import { demoLink, fillEmail, nextStep, newDemoToken } from "./pitchMachine";
import { demoState, newExpiry, lockDemoHtml, extractContacts, normaliseDeck, parseJsonLoose } from "../../supabase/functions/_shared/pitchDemo";

const html = "<!DOCTYPE html><html><head><base href='https://evil.example/'></head><body><h1>Hi</h1></body></html>";

describe("Client Pitch Machine demo link", () => {
  it("expires exactly 7 days after it is turned on", () => {
    const now = new Date("2026-11-18T00:00:00Z");
    expect(newExpiry(now)).toBe("2026-11-25T00:00:00.000Z");
  });

  it("is only open while switched on and before expiry", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    expect(demoState({ demo_html: html, demo_enabled: true, demo_expires_at: "2026-11-25T00:00:00Z" }, now)).toBe("active");
    expect(demoState({ demo_html: html, demo_enabled: false, demo_expires_at: "2026-11-25T00:00:00Z" }, now)).toBe("off");
    expect(demoState({ demo_html: html, demo_enabled: true, demo_expires_at: "2026-11-19T23:59:59Z" }, now)).toBe("expired");
    expect(demoState({ demo_html: null, demo_enabled: true, demo_expires_at: "2026-11-25T00:00:00Z" }, now)).toBe("not_built");
  });

  it("always points clients at oraclelunar.com, never a Lovable address", () => {
    const link = demoLink(newDemoToken());
    expect(link.startsWith("https://oraclelunar.com/demo/")).toBe(true);
    expect(link).not.toMatch(/lovable/);
  });

  it("gives every demo an unguessable 40-character code", () => {
    const a = newDemoToken(), b = newDemoToken();
    expect(a).toMatch(/^[a-f0-9]{40}$/);
    expect(a).not.toBe(b);
  });
});

describe("Locked demo", () => {
  it("cannot send or save anything online and is watermarked", () => {
    const out = lockDemoHtml(html, { businessName: "Joe's Cafe", expiresAt: "2026-11-25T00:00:00Z" });
    expect(out).toContain("connect-src 'none'");
    expect(out).toContain("form-action 'none'");
    expect(out).not.toMatch(/<base/i);
    expect(out).toContain("Not licensed for use");
    expect(out).toContain("Joe&#39;s Cafe");
  });
});

describe("Pitch content helpers", () => {
  it("finds public contact emails and phones but skips junk addresses", () => {
    const c = extractContacts("Call 07 5555 1234 or email hello@joescafe.com.au. logo@2x.png", ["mailto:bookings@joescafe.com.au", "https://joescafe.com.au/contact-us"], "https://joescafe.com.au");
    expect(c.emails).toContain("hello@joescafe.com.au");
    expect(c.emails).toContain("bookings@joescafe.com.au");
    expect(c.emails.some((e) => e.includes("@2x"))).toBe(false);
    expect(c.phones[0]).toContain("5555");
    expect(c.contactPage).toBe("https://joescafe.com.au/contact-us");
  });

  it("puts the demo link into the email", () => {
    expect(fillEmail("See it here: {{DEMO_LINK}}", "https://oraclelunar.com/demo/abc")).toBe("See it here: https://oraclelunar.com/demo/abc");
    expect(fillEmail("Hello", "L")).toContain("See your demo: L");
  });

  it("runs the steps in order: scan, audit, build, pitch", () => {
    expect(nextStep({})).toBe("scan");
    expect(nextStep({ snapshot: {} })).toBe("analyse");
    expect(nextStep({ snapshot: {}, audit: {} })).toBe("build");
    expect(nextStep({ snapshot: {}, audit: {}, demo_html: "<html>" })).toBe("pitch");
    expect(nextStep({ snapshot: {}, audit: {}, demo_html: "<html>", deck: {} })).toBeNull();
  });

  it("keeps slides to at most 8 and reads JSON wrapped in code fences", () => {
    const parsed = parseJsonLoose<any>("```json\n{\"slides\":[" + Array(10).fill('{"title":"x","bullets":["a"]}').join(",") + "]}\n```");
    expect(normaliseDeck(parsed)).toHaveLength(8);
  });
});

describe("Phone finder", () => {
  it("ignores long digit runs from picture links and page code", () => {
    const c = extractContacts("![img](https://cdn.site.com/228450093/1794964985596.jpg) id 170763335 Call (07) 3555 1234 or +61 412 345 678 or 1300 123 456", []);
    expect(c.phones).toEqual(["(07) 3555 1234", "+61 412 345 678", "1300 123 456"]);
  });
});
