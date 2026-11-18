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

import { scanKind, guessScanName, complaintQueries, cleanPriorScan } from "../../supabase/functions/app-builder-autonomous/visualSnapshot";

describe("App Builder complaint scan (members)", () => {
  it("knows Google Play and App Store links are apps", () => {
    expect(scanKind("https://play.google.com/store/apps/details?id=com.example")).toBe("google_play");
    expect(scanKind("https://apps.apple.com/au/app/example/id123")).toBe("app_store");
    expect(scanKind("https://www.example.com.au/")).toBe("website");
  });

  it("names apps from their store titles", () => {
    expect(guessScanName("Uber Eats: Food Delivery - Apps on Google Play", "https://play.google.com/store/apps/details?id=x")).toBe("Uber Eats");
    expect(guessScanName("", "https://www.bakery.com.au/")).toBe("bakery.com.au");
  });

  it("searches app store reviews for apps and review sites for websites, max 5", () => {
    const app = complaintQueries("Uber Eats", "https://play.google.com/store/apps/details?id=x");
    expect(app.map(q => q.source)).toContain("Google Play reviews");
    const site = complaintQueries("Bakery", "https://bakery.com.au");
    expect(site.map(q => q.source)).toEqual(expect.arrayContaining(["Trustpilot", "Google reviews"]));
    expect(site.length).toBeLessThanOrEqual(5);
  });

  it("never collects contact details (that stays in the owner-only Pitch Machine)", () => {
    const all = [...complaintQueries("X", "https://x.com"), ...complaintQueries("X", "https://play.google.com/store/apps/details?id=x")];
    expect(all.some(q => /email|contact|phone/i.test(q.query))).toBe(false);
  });

  it("reuses an earlier scan only as capped text", () => {
    expect(cleanPriorScan(null)).toBeNull();
    expect(cleanPriorScan({ visualBrief: 5 })).toBeNull();
    const s = cleanPriorScan({ visualBrief: "a".repeat(9000), siteAudit: "gaps" })!;
    expect(s.visualBrief.length).toBe(3000);
    expect(s.siteAudit).toBe("gaps");
  });
});
