import { describe, it, expect } from "vitest";
import { seoStaticHtml } from "./seoStaticHtml";
import { SEO_VARIANTS, PRICING_FAQ } from "./seoPages";

const index = `<html><head><title>Home title</title>
<meta name="description" content="Home desc" />
<meta property="og:title" content="Home og">
<meta property="og:url" content="https://oraclelunar.com/" />
</head><body><div id="root"></div></body></html>`;

describe("ready-made search pages for Google", () => {
  const v = SEO_VARIANTS["/kindroid-alternative"];
  const html = seoStaticHtml(index, v, [PRICING_FAQ], [{ href: "/ai-friend", label: "AI Friend" }]);
  it("uses the page's own title, description and address instead of the home page's", () => {
    expect(html).toContain(`<title>${v.title.replace(/&/g, "&amp;")} | ORACLE LUNAR</title>`);
    expect(html).not.toContain("Home title");
    expect(html).not.toContain("Home desc");
    expect(html).toContain('<link rel="canonical" href="https://oraclelunar.com/kindroid-alternative" />');
    expect(html).toContain('content="https://oraclelunar.com/kindroid-alternative"');
  });
  it("puts the page's heading, questions and links in the page text", () => {
    expect(html).toContain(`<h1>${v.h1}</h1>`);
    expect(html).toContain(PRICING_FAQ.q.replace(/'/g, "'"));
    expect(html).toContain('<a href="/ai-friend">AI Friend</a>');
  });
  it("writes every search page with a unique title", () => {
    const titles = Object.values(SEO_VARIANTS).map((x) => x.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
