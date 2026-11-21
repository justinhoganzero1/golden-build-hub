// Builds the ready-made HTML file for one search page from the built index.html.
// Google and other crawlers then read the page's own title, description, links and
// text straight away; the app still starts normally and replaces the text on load.
import type { SeoVariant } from "./seoPages";

const SITE = "https://oraclelunar.com";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function setMeta(html: string, attr: "name" | "property", key: string, value: string): string {
  const re = new RegExp(`<meta\\s+${attr}="${key.replace(/[:.]/g, "\\$&")}"\\s+content="[^"]*"\\s*/?>`, "i");
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `  ${tag}\n</head>`);
}

export function seoStaticHtml(
  indexHtml: string,
  v: SeoVariant,
  extraFaqs: { q: string; a: string }[],
  links: { href: string; label: string }[],
): string {
  const title = `${v.title} | ORACLE LUNAR`;
  const url = `${SITE}${v.path}`;
  const faqs = [...v.faqs, ...extraFaqs];
  let html = indexHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  html = setMeta(html, "name", "description", v.description);
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", v.description);
  html = setMeta(html, "property", "og:url", url);
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", v.description);
  html = html.replace(/<link\s+rel="canonical"[^>]*>/gi, "");
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  html = html.replace(
    "</head>",
    `  <link rel="canonical" href="${url}" />\n  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>\n</head>`,
  );
  const body = [
    `<main>`,
    `<h1>${esc(v.h1)}</h1>`,
    `<p>${esc(v.tagline)}</p>`,
    `<p>${esc(v.description)}</p>`,
    `<p><a href="/download">Download Oracle Lunar free</a></p>`,
    `<h2>Frequently asked questions</h2>`,
    ...faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`),
    `<nav aria-label="Site links">${links.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(" · ")}</nav>`,
    `</main>`,
  ].join("\n");
  return html.replace(/<div id="root"><\/div>/, `<div id="root">${body}</div>`);
}
