import { describe, it, expect } from "vitest";
import { cameFromLovable } from "./lovableVisitor";

describe("visitors arriving from Lovable see the funny ad first", () => {
  it("detects a click from Lovable's site", () => {
    expect(cameFromLovable({ referrer: "https://lovable.dev/projects/abc", ownHost: "oraclelunar.com" })).toBe(true);
  });
  it("detects the app shown inside a Lovable page", () => {
    expect(cameFromLovable({ ancestorOrigins: ["https://lovable.dev"], ownHost: "oraclelunar.com" })).toBe(true);
  });
  it("honours the ?from=lovable link", () => {
    expect(cameFromLovable({ search: "?from=lovable", ownHost: "oraclelunar.com" })).toBe(true);
  });
  it("leaves Google and direct visitors on the normal page", () => {
    expect(cameFromLovable({ referrer: "https://www.google.com/", ownHost: "oraclelunar.com" })).toBe(false);
    expect(cameFromLovable({ referrer: "", ownHost: "oraclelunar.com" })).toBe(false);
  });
  it("does not treat a look-alike address as Lovable", () => {
    expect(cameFromLovable({ referrer: "https://notlovable.dev/", ownHost: "oraclelunar.com" })).toBe(false);
  });
});

import { landingAdPath, isBotUserAgent } from "./lovableVisitor";

describe("every internet visitor sees the funny ad first, once per visit", () => {
  const ua = "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36";
  it("sends a first-time visitor to the funny ad", () => {
    expect(landingAdPath({ ua, alreadyShown: false, fromLovable: false })).toBe("/ad?v=funny&from=web");
  });
  it("keeps the Lovable version for Lovable visitors", () => {
    expect(landingAdPath({ ua, alreadyShown: false, fromLovable: true })).toBe("/ad?v=funny&from=lovable");
  });
  it("does not repeat the ad in the same visit", () => {
    expect(landingAdPath({ ua, alreadyShown: true, fromLovable: false })).toBeNull();
  });
  it("lets Google and link previews see the normal home page", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(landingAdPath({ ua: "facebookexternalhit/1.1", alreadyShown: false, fromLovable: false })).toBeNull();
  });
});

import { cameFromSearch } from "./lovableVisitor";

describe("Google visitors land straight on the download page", () => {
  const ua = "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36";
  it("recognises Google, Bing and the Google phone app", () => {
    expect(cameFromSearch("https://www.google.com/")).toBe(true);
    expect(cameFromSearch("https://www.google.com.au/")).toBe(true);
    expect(cameFromSearch("https://www.bing.com/search?q=oracle")).toBe(true);
    expect(cameFromSearch("android-app://com.google.android.googlequicksearchbox/")).toBe(true);
  });
  it("does not treat other sites or direct visits as search", () => {
    expect(cameFromSearch("")).toBe(false);
    expect(cameFromSearch("https://facebook.com/")).toBe(false);
    expect(cameFromSearch("https://notgoogle.com/")).toBe(false);
  });
  it("skips the ad for a search visitor", () => {
    expect(landingAdPath({ ua, alreadyShown: false, fromLovable: false, fromSearch: true })).toBeNull();
  });
});
