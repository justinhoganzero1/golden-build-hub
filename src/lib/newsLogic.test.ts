import { describe, it, expect } from "vitest";
import {
  parseFeed, normaliseUrl, publisherKey, titleTokens, similarity, bestMatch, classifyVerification,
  selectStories, rateFootage, usableInDownload, strayItemIndexes, robotsAllows, dailyStepDue, brisbaneClock, isBreaking, initialStatus, extractArticleText,
} from "../../supabase/functions/_shared/newsLogic";

const rss = `<rss><channel><item><title><![CDATA[PM meets leaders in Canberra]]></title><link>https://www.abc.net.au/news/1?utm_source=rss</link>
<description>&lt;p&gt;Talks begin&lt;/p&gt;</description><pubDate>Fri, 20 Nov 2026 01:00:00 GMT</pubDate></item></channel></rss>`;
const atom = `<feed><entry><id>yt:video:abc</id><yt:videoId>abc123</yt:videoId><title>Rocket launch replay</title>
<link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/><published>2026-11-20T00:00:00+00:00</published>
<media:group><media:thumbnail url="https://i.ytimg.com/vi/abc123/hq.jpg" width="480"/></media:group></entry></feed>`;

describe("news feeds", () => {
  it("reads an RSS item with CDATA and strips tracking from the link", () => {
    const [e] = parseFeed(rss);
    expect(e.title).toBe("PM meets leaders in Canberra");
    expect(e.summary).toBe("Talks begin");
    expect(normaliseUrl(e.link)).toBe("https://www.abc.net.au/news/1");
    expect(e.published).toBe("2026-11-20T01:00:00.000Z");
  });
  it("reads a YouTube channel Atom entry with its video id", () => {
    const [e] = parseFeed(atom);
    expect(e.videoId).toBe("abc123");
    expect(e.link).toBe("https://www.youtube.com/watch?v=abc123");
    expect(e.thumbnail).toBe("https://i.ytimg.com/vi/abc123/hq.jpg");
  });
});

describe("duplicates and verification", () => {
  it("treats two ABC feeds as one publisher and BBC hosts as one", () => {
    expect(publisherKey("https://www.abc.net.au/news/a")).toBe(publisherKey("https://abc.net.au/news/b"));
    expect(publisherKey("https://feeds.bbci.co.uk/x")).toBe(publisherKey("https://www.bbc.com/news/y"));
  });
  it("matches the same story told with different headlines", () => {
    const a = titleTokens("Bushfire emergency warning issued for Gympie residents");
    const b = titleTokens("Gympie residents told to evacuate as bushfire emergency grows");
    expect(similarity(a, b)).toBeGreaterThanOrEqual(0.5);
    expect(bestMatch(b, [{ id: "x", tokens: a }])?.id).toBe("x");
    expect(bestMatch(titleTokens("Reserve Bank holds interest rates"), [{ id: "x", tokens: a }])).toBeNull();
  });
  it("labels two independent outlets as corroborated, one fresh outlet as developing", () => {
    expect(classifyVerification({ publishers: ["abc.net.au", "bbc"], titles: ["a", "b"], hoursOld: 2 })).toBe("corroborated");
    expect(classifyVerification({ publishers: ["abc.net.au", "abc.net.au"], titles: ["a", "b"], hoursOld: 2 })).toBe("developing");
    expect(classifyVerification({ publishers: ["abc.net.au"], titles: ["a"], hoursOld: 10 })).toBe("single_source");
    expect(classifyVerification({ publishers: ["abc.net.au", "bbc"], titles: ["a"], conflicts: "death toll differs", hoursOld: 2 })).toBe("conflicting");
    expect(classifyVerification({ publishers: ["bbc"], titles: ["Correction: earlier report"], hoursOld: 1 })).toBe("corrected_or_withdrawn");
  });
  it("flags breaking news only for fresh, widely reported stories", () => {
    expect(isBreaking({ source_count: 3, official_count: 0, hoursOld: 1, verification: "corroborated" })).toBe(true);
    expect(isBreaking({ source_count: 3, official_count: 0, hoursOld: 5, verification: "corroborated" })).toBe(false);
  });
});

describe("editorial director", () => {
  const base = { category: "general", official_count: 0, is_breaking: false, status: "new", hoursOld: 2, verification: "corroborated", source_count: 2 };
  const stories = [
    { ...base, id: "au1", region: "au", importance: 50 }, { ...base, id: "au2", region: "au", importance: 40 },
    { ...base, id: "in1", region: "intl", importance: 60 }, { ...base, id: "in2", region: "intl", importance: 30 },
    { ...base, id: "used", region: "au", importance: 99, status: "used" },
    { ...base, id: "unv", region: "au", importance: 98, verification: "unverified" },
  ];
  it("honours the story count and Australian share and never reuses or picks unverified stories", () => {
    const picked = selectStories(stories, { story_count: 2, au_share: 50, categories: ["general"], duration_minutes: 5, breaking_priority: true });
    expect(picked.map((s) => s.id).sort()).toEqual(["au1", "in1"]);
  });
  it("makes a shorter bulletin rather than padding when stories run out", () => {
    const picked = selectStories(stories, { story_count: 10, au_share: 60, categories: ["general"], duration_minutes: 5, breaking_priority: true });
    expect(picked.length).toBe(4);
  });
});

describe("footage rights", () => {
  const f = { commercial_use: false, editing_allowed: false, approval_status: "pending", permission_expiry: null };
  it("rates NASA public-domain footage green and official YouTube embeds amber", () => {
    expect(rateFootage({ ...f, source_kind: "nasa_video" })).toBe("green");
    expect(rateFootage({ ...f, source_kind: "youtube_rss", approval_status: "embed_only" })).toBe("amber");
  });
  it("needs written commercial and editing permission before other footage turns green", () => {
    expect(rateFootage({ ...f, source_kind: "youtube_rss", approval_status: "approved", commercial_use: true, editing_allowed: false })).toBe("amber");
    expect(rateFootage({ ...f, source_kind: "youtube_rss", approval_status: "approved", commercial_use: true, editing_allowed: true })).toBe("green");
  });
  it("blocks denied or expired permission", () => {
    expect(rateFootage({ ...f, source_kind: "nasa_video", approval_status: "denied" })).toBe("red");
    expect(rateFootage({ ...f, source_kind: "youtube_rss", approval_status: "approved", commercial_use: true, editing_allowed: true, permission_expiry: "2026-01-01" }, "2026-11-20")).toBe("red");
  });
  it("only puts green footage we hold a copy of into downloadable broadcasts", () => {
    expect(usableInDownload({ rating: "green", file_path: "footage/a.mp4" })).toBe(true);
    expect(usableInDownload({ rating: "amber", file_path: "footage/a.mp4" })).toBe(false);
    expect(usableInDownload({ rating: "green", file_path: null })).toBe(false);
  });
});

describe("robots and schedule", () => {
  it("obeys Disallow rules", () => {
    const robots = "User-agent: *\nDisallow: /iview/\nAllow: /iview/public";
    expect(robotsAllows(robots, "/news/feed/51120/rss.xml")).toBe(true);
    expect(robotsAllows(robots, "/iview/show")).toBe(false);
    expect(robotsAllows(robots, "/iview/public/x")).toBe(true);
  });
  it("runs research from 5 am and production from 6 am Brisbane time", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 10, 19, h - 10 + 24, 3)); // Brisbane hour h on 20 Nov
    expect(brisbaneClock(at(5))).toEqual({ date: "2026-11-20", hour: 5 });
    expect(dailyStepDue(at(4), {}, "approval")).toBeNull();
    expect(dailyStepDue(at(5), {}, "approval")).toBe("research");
    expect(dailyStepDue(at(5), { research: "2026-11-20" }, "approval")).toBeNull();
    expect(dailyStepDue(at(6), { research: "2026-11-20" }, "approval")).toBe("produce");
    expect(dailyStepDue(at(6), { research: "2026-11-20" }, "manual")).toBeNull();
    expect(dailyStepDue(at(7), { research: "2026-11-20", produce: "2026-11-20" }, "automatic")).toBeNull();
  });
  it("maps production modes to the first broadcast status", () => {
    expect(initialStatus("automatic")).toBe("approved");
    expect(initialStatus("approval")).toBe("awaiting_approval");
    expect(initialStatus("manual")).toBe("scripted");
  });
  it("extracts paragraph text from an article page", () => {
    const html = `<nav><p>Menu menu menu menu menu menu menu menu menu menu menu menu menu</p></nav><p>${"Real reporting sentence. ".repeat(4)}</p><script>x</script>`;
    expect(extractArticleText(html)).toContain("Real reporting sentence.");
    expect(extractArticleText(html)).not.toContain("Menu");
  });
});

describe("dates never glue unrelated stories together", () => {
  it("ignores numbers and month names when matching headlines", () => {
    expect(titleTokens("APOD: 2026 November 20 – V-G-R")).toEqual(["apod"]);
    expect(similarity(titleTokens("Budget 2026 November vote"), titleTokens("Flood 2026 November warning"))).toBe(0);
  });
});

import { nasaQuery } from "../../supabase/functions/_shared/newsLogic";
describe("NASA footage search words", () => {
  it("uses the story's repeated proper names", () => {
    expect(nasaQuery("APOD: 2026 November 20 – V-G-R", "NASA says Voyager 1 reached one light-day. Voyager's call sign was flashed.")).toBe("Voyager");
  });
});

describe("strayItemIndexes", () => {
  it("detaches unrelated headlines wrongly grouped into a story", () => {
    const titles = ["APOD: 2026 November 20 – V-G-R", "BIIGC joint communique: November 2026", "PM speech at coalition of the willing in Berlin: 19 November 2026"];
    expect(strayItemIndexes("APOD: 2026 November 20 – V-G-R", titles)).toEqual([1, 2]);
  });
  it("keeps genuine reports of the same story", () => {
    const titles = ["Xi praises Albanese over China relations turnaround", "Xi Jinping hails turnaround in China relations with Albanese"];
    expect(strayItemIndexes("Xi praises Albanese over China relations turnaround", titles)).toEqual([]);
  });
});
