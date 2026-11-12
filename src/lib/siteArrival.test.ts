import { describe, it, expect } from "vitest";
import { buildArrival, countryFromTimeZone, shouldRecordArrival } from "./siteArrival";
import { countryName } from "../../supabase/functions/_shared/countries";

describe("site arrivals", () => {
  it("records the landing page and the Reddit campaign from a tagged link", () => {
    const row = buildArrival("https://oraclelunar.com/download?utm_source=Reddit&utm_medium=social&utm_campaign=aicompanions", "", "UA");
    expect(row.landing_path).toBe("/download");
    expect(row.source).toBe("reddit");
    expect(row.campaign).toBe("aicompanions");
  });

  it("uses the linking site when there is no campaign tag", () => {
    expect(buildArrival("https://oraclelunar.com/", "https://m.facebook.com/somepost", "UA").source).toBe("m.facebook.com");
  });

  it("calls a visit with no link and no tag direct", () => {
    expect(buildArrival("https://www.oraclelunar.com/", "https://oraclelunar.com/about", "UA").source).toBe("direct");
  });

  it("only counts the real website, never the preview, the app or owner pages", () => {
    expect(shouldRecordArrival("oraclelunar.com", "/")).toBe(true);
    expect(shouldRecordArrival("www.oraclelunar.com", "/ad")).toBe(true);
    expect(shouldRecordArrival("localhost", "/")).toBe(false);
    expect(shouldRecordArrival("golden-vault-builder.lovable.app", "/")).toBe(false);
    expect(shouldRecordArrival("oraclelunar.com", "/owner-dashboard")).toBe(false);
  });

  it("guesses the visitor's country from their time zone when the network gives none", () => {
    expect(countryFromTimeZone("Australia/Brisbane")).toBe("AU");
    expect(countryFromTimeZone("America/New_York")).toBe("US");
    expect(countryFromTimeZone("Europe/London")).toBe("GB");
    expect(countryFromTimeZone("Etc/UTC")).toBeNull();
  });

  it("shows country names, not codes", () => {
    expect(countryName("au")).toBe("Australia");
    expect(countryName("US")).toBe("United States");
  });
});
