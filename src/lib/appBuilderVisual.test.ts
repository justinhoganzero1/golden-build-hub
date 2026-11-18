import { describe, it, expect } from "vitest";
import { extractInspirationUrls, cleanSiteUrl, summariseBranding } from "../../supabase/functions/app-builder-autonomous/visualSnapshot";

describe("App Builder website inspiration", () => {
  it("picks up website links from the request, at most two sites", () => {
    const urls = extractInspirationUrls("Make me an app like https://stripe.com/au, and www.canva.com and https://notion.so");
    expect(urls).toEqual(["https://stripe.com/au", "https://www.canva.com/"]);
  });

  it("refuses private or local addresses", () => {
    expect(cleanSiteUrl("http://localhost:8080")).toBeNull();
    expect(cleanSiteUrl("http://192.168.1.4/admin")).toBeNull();
    expect(cleanSiteUrl("http://10.0.0.2")).toBeNull();
    expect(cleanSiteUrl("ftp://example.com")).toBeNull();
  });

  it("returns nothing when no link is given", () => {
    expect(extractInspirationUrls("build me a plumbing app")).toEqual([]);
  });

  it("summarises colours and fonts", () => {
    const s = summariseBranding({ colorScheme: "dark", colors: { primary: "#FF6B35" }, typography: { fontFamilies: { heading: "Inter" } } });
    expect(s).toContain("#FF6B35");
    expect(s).toContain("heading Inter");
  });
});
