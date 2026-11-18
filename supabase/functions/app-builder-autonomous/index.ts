// Autonomous multi-stage app builder.
// Pipeline: ARCHITECT -> BACKEND -> FRONTEND -> FLESH -> SMOKE TEST -> FIX (loop up to N) -> FINAL
// Streams Server-Sent Events with stage updates and the final HTML code.
// Uses Lovable AI Gateway (no extra API key required).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser, enforceRateLimit } from "../_shared/requireAuth.ts";
import { chargeAI, InsufficientCoinsError, PlanRequiredError } from "../_shared/wallet.ts";
import { PROVIDER_RATES } from "../_shared/pricing.ts";
import {
  extractInspirationUrls, summariseBranding, scanKind, guessScanName, complaintQueries, cleanPriorScan,
  type SiteSnapshot,
} from "./visualSnapshot.ts";
import { resolvePurpose } from "./purpose.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
// Most powerful model available via Lovable AI Gateway.
const MODEL_PRIMARY = "openai/gpt-5.5";
const MODEL_FAST = "openai/gpt-5-mini"; // used for smoke test reasoning

const MAX_FIX_LOOPS = 3;

// ───────────── Web research (Firecrawl) ─────────────
// Lets the builder look up real solutions on the web when smoke tests fail.
// Safety: refuses queries that look like attempts to attack/exploit systems.

const HACK_PATTERNS = [
  /\b(exploit|0[- ]?day|cve[- ]\d|payload|reverse shell|metasploit|sqlmap|burp|cobalt strike)\b/i,
  /\b(bypass (auth|login|paywall|2fa|mfa)|crack (password|license|drm)|keygen|carding)\b/i,
  /\b(ddos|botnet|malware|ransomware|keylogger|rootkit|backdoor)\b/i,
  /\b(steal (cookies|tokens|credentials|session)|exfiltrate|harvest credentials)\b/i,
  /\b(hack into|gain unauthorized access|escalate privileges|jailbreak (ios|android|the system))\b/i,
];
function looksLikeHacking(q: string): boolean {
  return HACK_PATTERNS.some((re) => re.test(q));
}

async function webResearch(query: string, userId?: string): Promise<{ summary: string; sources: { url: string; title?: string }[] }> {
  const FIRECRAWL = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL) return { summary: "(web research unavailable — no FIRECRAWL_API_KEY)", sources: [] };
  if (looksLikeHacking(query)) {
    return { summary: "REFUSED: query looks like an attempt to attack or exploit a system. The builder only researches legitimate dev/UX problems.", sources: [] };
  }
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 4, scrapeOptions: { formats: ["markdown"] } }),
    });
    const d = await r.json().catch(() => ({}));
    // Members pay their own search cost (+ margin, applied by the wallet).
    if (r.ok && userId) {
      await chargeAI(userId, "app-builder-autonomous", PROVIDER_RATES.firecrawl_search_5_pages, { provider: "firecrawl", kind: "web_search" });
    }
    const arr = d?.data || d?.web?.results || [];
    const sources = (Array.isArray(arr) ? arr : []).slice(0, 4).map((s: any) => ({
      url: s.url, title: s.title,
      md: (s.markdown || s.description || "").slice(0, 2500),
    }));
    const summary = sources.map((s: any, i: number) => `[${i + 1}] ${s.title || s.url}\n${s.url}\n${s.md}`).join("\n\n---\n\n") || "(no results)";
    return { summary, sources: sources.map(({ url, title }) => ({ url, title })) };
  } catch (e) {
    if (e instanceof InsufficientCoinsError || e instanceof PlanRequiredError) throw e;
    return { summary: `(web research failed: ${e instanceof Error ? e.message : String(e)})`, sources: [] };
  }
}

// ───────────── Visual website snapshot (Firecrawl screenshots) ─────────────
// Takes real desktop + phone pictures of a website the member names, so the
// builder can SEE its visual style instead of guessing from text alone.
const VISION_MODEL = "google/gemini-3.8-flash";

async function firecrawlScrape(body: Record<string, unknown>): Promise<any> {
  const FIRECRAWL = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL) throw new Error("website pictures unavailable");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60_000);
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d?.success === false) throw new Error(`Firecrawl ${r.status}: ${String(d?.error || "").slice(0, 200)}`);
    return d?.data || {};
  } finally {
    clearTimeout(timer);
  }
}

async function snapshotSite(url: string): Promise<SiteSnapshot> {
  const [desk, mob] = await Promise.allSettled([
    firecrawlScrape({ url, formats: [{ type: "screenshot", fullPage: false }, "branding", "markdown"], onlyMainContent: false, waitFor: 1500 }),
    firecrawlScrape({ url, formats: [{ type: "screenshot", fullPage: false }], mobile: true, waitFor: 1500 }),
  ]);
  const d = desk.status === "fulfilled" ? desk.value : {};
  const m = mob.status === "fulfilled" ? mob.value : {};
  if (!d.screenshot && !m.screenshot) {
    const why = desk.status === "rejected" ? String(desk.reason?.message || desk.reason) : "no picture returned";
    throw new Error(why);
  }
  return {
    url,
    title: d?.metadata?.title || m?.metadata?.title,
    desktop: typeof d.screenshot === "string" ? d.screenshot : undefined,
    mobile: typeof m.screenshot === "string" ? m.screenshot : undefined,
    brandingNote: summariseBranding(d.branding),
    textSample: String(d.markdown || "").slice(0, 3000),
  };
}

// ───────── Complaint scan (what real customers dislike) ─────────
// Searches public reviews (Google, Trustpilot, Facebook, ProductReview, Reddit,
// Google Play / App Store) for each site or app the member wants to learn from.
// No contact details are collected — that belongs to the owner-only Pitch Machine.
type ReviewItem = { source: string; site: string; url: string; title?: string; text: string };

async function searchComplaints(snaps: SiteSnapshot[], userId: string): Promise<ReviewItem[]> {
  const FIRECRAWL = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL) return [];
  const perSite = snaps.length > 1 ? 3 : 5;
  const jobs = snaps.flatMap((s) => {
    const name = guessScanName(s.title, s.url);
    return complaintQueries(name, s.url).slice(0, perSite).map((q) => ({ ...q, site: name }));
  });
  const results = await Promise.allSettled(jobs.map(async (q) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45_000);
    try {
      const r = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.query, limit: 3, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }),
        signal: ctl.signal,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`search ${r.status}`);
      await chargeAI(userId, "app-builder-autonomous", PROVIDER_RATES.firecrawl_search_5_pages, { provider: "firecrawl", kind: "complaint_search" });
      const arr = d?.data?.web || d?.data || [];
      return { q, arr: Array.isArray(arr) ? arr : [] };
    } finally {
      clearTimeout(timer);
    }
  }));
  const items: ReviewItem[] = [];
  const seen = new Set<string>();
  for (const res of results) {
    if (res.status === "rejected") {
      if (res.reason instanceof InsufficientCoinsError || res.reason instanceof PlanRequiredError) throw res.reason;
      continue;
    }
    for (const s of res.value.arr) {
      if (!s?.url || seen.has(s.url)) continue;
      seen.add(s.url);
      items.push({
        source: res.value.q.source,
        site: res.value.q.site,
        url: String(s.url),
        title: s.title ? String(s.title).slice(0, 200) : undefined,
        text: String(s.markdown || s.description || "").replace(/\s+/g, " ").slice(0, 2000),
      });
    }
  }
  return items.slice(0, 18);
}

// Allow-list of CDN hosts the builder may add to <script> / <link> tags.
const SAFE_CDN_HOSTS = [
  "cdn.tailwindcss.com", "cdn.jsdelivr.net", "unpkg.com", "esm.sh",
  "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com",
  "ga.jspm.io", "code.iconify.design", "api.iconify.design",
];


async function callAI(opts: {
  apiKey: string;
  system: string;
  user: string;
  model?: string;
  reasoning?: "minimal" | "low" | "medium" | "high";
  images?: string[];
  userId?: string;
}): Promise<string> {
  const { apiKey, system, user, model = MODEL_PRIMARY, reasoning = "medium", images = [], userId } = opts;

  const userContent: any =
    images.length > 0
      ? [
          { type: "text", text: user },
          ...images.slice(0, 4).map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : user;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
  };
  if (model.startsWith("openai/gpt-5")) {
    body.reasoning = { effort: reasoning };
  }

  const resp = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";

  // Bill the user's wallet for this completed AI step only after the
  // provider call actually succeeded. Long multi-step builds are charged
  // incrementally, one step at a time, so a mid-build failure never bills
  // for work that was never delivered.
  if (userId) {
    const rate = model.startsWith("openai/gpt-5")
      ? PROVIDER_RATES.lovable_ai_gpt5_per_call
      : PROVIDER_RATES.lovable_ai_gemini_flash_per_call;
    await chargeAI(userId, "app-builder-autonomous", rate, { provider: "lovable-ai", model });
  }

  return content;
}

function extractCode(text: string): string {
  // 1. Look for explicit fenced HTML
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence && /<!doctype|<html/i.test(fence[1])) return fence[1].trim();
  // 2. Look for raw <!DOCTYPE...</html>
  const doc = text.match(/<!DOCTYPE[\s\S]*?<\/html>/i);
  if (doc) return doc[0];
  // 3. Try CODE_START/END
  const tag = text.match(/CODE_START\s*([\s\S]*?)\s*CODE_END/);
  if (tag) return tag[1].trim();
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const __rl = await enforceRateLimit(req, auth.user, "app-builder-autonomous");
  if (__rl) return __rl;



  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: { prompt?: string; images?: string[]; currentCode?: string; inspirationUrls?: string[]; mode?: string; priorScan?: unknown; purpose?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userPrompt = (payload.prompt || "").slice(0, 8000);
  const images = Array.isArray(payload.images) ? payload.images.slice(0, 4) : [];
  const currentCode = (payload.currentCode || "").slice(0, 12000);
  const inspirationUrls = extractInspirationUrls(userPrompt, Array.isArray(payload.inspirationUrls) ? payload.inspirationUrls : []);

  const priorScan = cleanPriorScan(payload.priorScan);
  // Own use (default) vs an app to sell — shapes every stage below.
  const purpose = resolvePurpose(payload.purpose, userPrompt);
  const personal = purpose === "personal";
  const purposeBlock = personal
    ? "PURPOSE: this app is for the member's OWN use (or their family/team). No prices, paywalls, checkout, adverts, testimonials, marketing pages or store listing. Focus on making their own daily task fast, private and delightful.\n\n"
    : "PURPOSE: the member is building this app TO SELL. Include positioning, pricing, a paywall/checkout stub and launch-ready marketing copy.\n\n";
  const scanOnly = payload.mode === "scan";
  if ((payload.mode === "visual_only" || scanOnly) && inspirationUrls.length === 0) {
    return new Response(JSON.stringify({ error: "No public website link found" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!userPrompt && images.length === 0 && !currentCode) {
    return new Response(JSON.stringify({ error: "Empty prompt" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ event, ...((typeof data === "object" && data) || { value: data }) })}\n\n`));
      };

      try {
        // === STAGE -1: VISUAL WEBSITE ASSESSMENT ===
        // Takes real desktop + phone pictures of any website the member names,
        // then a vision model studies them like a designer. The result guides
        // every later stage, with strict rules to avoid copying protected work.
        let visualBrief = priorScan?.visualBrief || "";
        let visualImages: string[] = [];
        let siteSummary = "";
        let siteAudit = priorScan?.siteAudit || "";
        const snaps: SiteSnapshot[] = [];
        if (priorScan) {
          send("stage", { stage: "visual", message: "Using your earlier website/app scan — no need to pay for it twice" });
          siteSummary = (visualBrief.match(/## What the site does[^\n]*\n([\s\S]*?)\n##/)?.[1] || "").trim().slice(0, 400);
        }
        if (inspirationUrls.length && !priorScan) {
          const kinds = inspirationUrls.map(scanKind);
          const what = kinds.every((k) => k !== "website") ? (kinds.length === 1 ? "the app's store page" : "the apps' store pages")
            : inspirationUrls.length === 1 ? "the website" : `${inspirationUrls.length} websites/apps`;
          send("stage", { stage: "visual", message: `Taking desktop + phone pictures of ${what}…` });
          for (const url of inspirationUrls) {
            try {
              const snap = await snapshotSite(url);
              await chargeAI(auth.user.id, "app-builder-autonomous", PROVIDER_RATES.firecrawl_visual_snapshot_per_site, { provider: "firecrawl", kind: "website_snapshot", url });
              snaps.push(snap);
            } catch (e) {
              if (e instanceof InsufficientCoinsError || e instanceof PlanRequiredError) throw e;
              send("stage", { stage: "visual", message: `Couldn't photograph ${url} (${e instanceof Error ? e.message.slice(0, 120) : "error"})` });
            }
          }
          if (snaps.length) {
            send("visual_refs", { sites: snaps.map((s) => ({ url: s.url, title: s.title, desktop: s.desktop, mobile: s.mobile })) });
            visualImages = snaps.flatMap((s) => [s.desktop, s.mobile]).filter((x): x is string => !!x).slice(0, 4);
            send("stage", { stage: "visual", message: "Studying the pictures like a designer — style, layout, colours, photos…" });
            const notes = snaps.map((s, i) => `SITE ${i + 1}: ${s.url}${s.title ? ` — "${s.title}"` : ""}\nMeasured branding: ${s.brandingNote || "(none)"}\nPage text sample (for understanding only, NEVER reuse):\n${s.textSample || "(none)"}`).join("\n\n");
            try {
              visualBrief = await callAI({
                apiKey, userId: auth.user.id, model: VISION_MODEL,
                system: `You are a senior visual designer and IP-aware creative director. You are shown real screenshots (desktop, then phone) of website(s) the client likes as INSPIRATION. Study the PICTURES, not just the text. Output a VISUAL DESIGN BRIEF in markdown (< 550 words, no preamble) with these headings:
## What the site does (1-2 lines, plain words)
## What the pictures show (identify the photos/illustrations: subjects, people, products, scenes, mood, lighting)
## Art style & feel (e.g. minimal, luxury, playful, corporate, 3D, glassmorphism, flat illustration)
## Layout (hero structure, grid, section order, density, whitespace, navigation, phone layout differences)
## Colour palette (5-6 hex values with roles, read from the pictures + measured branding)
## Typography (heading/body style: serif/sans/geometric, weight, size contrast — suggest free Google Font equivalents)
## Components (buttons, cards, forms, icons, borders, shadows, corner radius)
## Motion cues (only if inferable)
## LEGAL ADAPTATION — what we must NOT copy
List the specific brand names, logos, slogans, taglines, copywriting, product names, photos, illustrations, mascots and any distinctive trade dress seen. State that the new app takes only the general style, layout principles and quality bar, and uses 100% original name, logo, wording and imagery, with a palette shifted enough to avoid confusion with the original brand.`,
                user: `${notes}\n\nCLIENT REQUEST:\n${userPrompt}`,
                images: visualImages,
              });
              siteSummary = (visualBrief.match(/## What the site does[^\n]*\n([\s\S]*?)\n##/)?.[1] || "").trim().slice(0, 400);
              send("stage", { stage: "visual", message: "Visual design brief ready — style captured, brand assets excluded", detail: visualBrief.slice(0, 600) });
            } catch (e) {
              if (e instanceof InsufficientCoinsError || e instanceof PlanRequiredError) throw e;
              send("stage", { stage: "visual", message: `Picture study skipped (${e instanceof Error ? e.message.slice(0, 120) : "error"})` });
              visualImages = [];
            }
          }
        }

        // === STAGE -0.5: COMPLAINTS + GAP AUDIT ===
        // Reads what real customers say about the site/app (reviews, store
        // ratings, forums), then audits the pictures + text for what is missing,
        // so the member's new app fixes every pain point from day one.
        if (snaps.length && !siteAudit && payload.mode !== "visual_only") {
          let reviews: ReviewItem[] = [];
          try {
            send("stage", { stage: "complaints", message: "Reading real customer reviews & complaints (Google, Trustpilot, Facebook, app stores, Reddit)…" });
            reviews = await searchComplaints(snaps, auth.user.id);
            send("stage", { stage: "complaints", message: reviews.length ? `Found ${reviews.length} review pages to learn from` : "No public reviews found — auditing the design only" });
          } catch (e) {
            if (e instanceof InsufficientCoinsError || e instanceof PlanRequiredError) throw e;
            send("stage", { stage: "complaints", message: `Review scan skipped (${e instanceof Error ? e.message.slice(0, 120) : "error"})` });
          }
          try {
            send("stage", { stage: "audit", message: "Auditing what's missing, broken or frustrating…" });
            const reviewText = reviews.map((r, i) => `[${i + 1}] (${r.source} — about ${r.site}) ${r.url}\n${r.title ? r.title + "\n" : ""}${r.text}`).join("\n\n").slice(0, 20000);
            const siteText = snaps.map((s, i) => `SITE/APP ${i + 1}: ${s.url} (${scanKind(s.url).replace("_", " ")})${s.title ? ` — "${s.title}"` : ""}\nText sample (understanding only):\n${(s.textSample || "").slice(0, 2000)}`).join("\n\n");
            siteAudit = await callAI({
              apiKey, userId: auth.user.id, model: VISION_MODEL,
              system: `You are a senior UX researcher and product strategist helping a member build a BETTER app than the website(s)/app(s) shown. Study the screenshots like a designer and the review text like a customer researcher. Output a SITE & APP AUDIT in markdown (< 500 words, no preamble) with these headings:
## Score (current experience out of 10, one line why)
## What works (keep the idea, not the wording)
## What's missing (features, pages, info, phone experience, accessibility, trust signals)
## What customers complain about (each: the pain in plain words — source name; ONLY from the review text supplied, never invented; review titles, star ratings and snippets count; ignore results about a different business or staff/job reviews; if nothing negative was found, say so)
## Must-fix list for the new app (6-10 concrete features or design decisions that answer every complaint and gap)
## Who uses it (customers, and the owner/staff side if it is a business)
Never suggest copying brand names, logos, slogans, wording or photos.`,
              user: `${siteText}\n\nWHAT PEOPLE SAY ONLINE:\n${reviewText || "(no reviews found)"}\n\nMEMBER'S REQUEST:\n${userPrompt}`,
              images: visualImages,
            });
            const complaintSources = reviews.slice(0, 10).map((r) => ({ url: r.url, title: r.title || r.site, source: r.source }));
            send("site_audit", { audit: siteAudit.slice(0, 3500), sources: complaintSources });
            send("stage", { stage: "audit", message: "Audit ready — complaints and gaps turned into a must-fix list", detail: siteAudit.slice(0, 600) });
          } catch (e) {
            if (e instanceof InsufficientCoinsError || e instanceof PlanRequiredError) throw e;
            send("stage", { stage: "audit", message: `Audit skipped (${e instanceof Error ? e.message.slice(0, 120) : "error"})` });
            siteAudit = "";
          }
        }
        const auditBlock = siteAudit
          ? `SITE & APP AUDIT (real customer complaints + gaps of the website/app the member wants to beat — the new app MUST solve every item in its must-fix list):\n${siteAudit}\n\n`
          : "";

        // Scan-only mode: the member checks the website/app first, then decides to build.
        if (scanOnly) {
          send("done", { code: "", visualBrief: visualBrief.slice(0, 3000), siteAudit: siteAudit.slice(0, 3500), sites: inspirationUrls });
          controller.close();
          return;
        }
        const visualBlock = visualBrief
          ? `VISUAL DESIGN BRIEF (from real screenshots of the inspiration website — follow its style and quality, obey its LEGAL ADAPTATION rules: never reuse its brand name, logo, wording, photos or trademarks):\n${visualBrief}\n\n`
          : "";

        // Look-only mode: stop after the website study (used for quick checks).
        if (payload.mode === "visual_only") {
          send("done", { code: "", visualBrief: visualBrief.slice(0, 2500), sites: inspirationUrls });
          controller.close();
          return;
        }

        // === STAGE 0: MARKET RECON ===
        // Scours the live web for the competing apps in this category and, most
        // importantly, what real users COMPLAIN about in their reviews — so the
        // build can beat them on the exact points the market is unhappy about.
        let marketBrief = "";
        let marketSources: { url: string; title?: string }[] = [];
        try {
          send("stage", { stage: "market", message: personal ? "Looking at the top 10 similar apps & what their users wish they did…" : "Market recon — scanning the top 10 competing apps & real user reviews…" });
          const queriesRaw = await callAI({
            apiKey, userId: auth.user.id, model: MODEL_FAST, reasoning: "minimal",
            system: `Turn the user's app idea into EXACTLY 3 web-search queries, one per line, no numbering, no quotes:
1) top 10 best existing apps in this industry (competitors)
2) user reviews / complaints / 1-star feedback about those apps
3) missing features users are asking for in this category
Each query max 12 words.`,
            user: `${userPrompt || "a general purpose app"}${siteSummary ? `\n\nThe inspiration website does: ${siteSummary}` : ""}`,
          });
          const queries = queriesRaw.split("\n").map((q) => q.replace(/^[\d.\-*\s]+/, "").trim()).filter(Boolean).slice(0, 3);
          const results = await Promise.all(queries.map((q) => webResearch(q, auth.user.id)));
          marketSources = results.flatMap((r) => r.sources).slice(0, 10);
          const raw = results.map((r, i) => `### ${queries[i]}\n${r.summary}`).join("\n\n").slice(0, 24000);
          if (marketSources.length) {
            marketBrief = await callAI({
              apiKey, userId: auth.user.id, model: MODEL_PRIMARY, reasoning: "medium",
              system: `You are a competitive product strategist. From the raw web research, output a tight COMPETITIVE BRIEF (< 450 words, markdown bullets, no preamble):
- Top 10 competitors (name + what they do well), only as many as the research supports
- TOP 8 recurring user complaints / 1-star themes (quote the pain, be specific)
- Features users repeatedly beg for and don't get
${personal ? "- Best-loved features worth borrowing (as ideas, never copied)\n- THE WEDGE: 5 concrete decisions that make this app nicer to use every day than any of them" : "- Pricing norms in this category\n- THE WEDGE: 5 concrete decisions this new app must make to beat every competitor listed"}
Only use what is supported by the research. No invented product names.`,
              user: raw,
            });
            send("stage", { stage: "market", message: `Competitive brief ready — ${marketSources.length} live sources analysed`, detail: marketBrief.slice(0, 600), sources: marketSources });
            send("research_sources", { sources: marketSources });
          } else {
            send("stage", { stage: "market", message: "No live sources — building from category best-practice knowledge" });
          }
        } catch (e) {
          if (e instanceof InsufficientCoinsError || e instanceof PlanRequiredError) throw e;
          send("stage", { stage: "market", message: `Market recon skipped (${e instanceof Error ? e.message : "error"})` });
        }

        // === STAGE 1: ARCHITECT ===
        send("stage", { stage: "architect", message: "Designing app architecture & framework…" });
        const architecture = await callAI({
          apiKey, userId: auth.user.id,
          model: MODEL_PRIMARY,
          reasoning: "high",
          system: `You are a principal software architect. The user gives ONE command; you design the WHOLE ship-ready product from it — do not ask questions, do not leave TODOs, assume and decide everything.
Output ONLY a concise, dense spec (no preamble, no closing) covering:
- App name & tagline
${personal ? "- Why it suits this member better than the similar apps in the brief (one line each)" : "- Positioning: how this beats each competitor named in the competitive brief (one line each)"}
- Core user flows (numbered, max 8)
- Page sections / routes
- Data model (fields per entity)
- Backend endpoints / mock APIs (since output must be single-file HTML, design as in-page JS modules + localStorage persistence)
- Third-party APIs needed (Stripe, Web Speech, etc.)
- Visual style (colors, typography, motion)
${personal ? "- Privacy & data: stays on the device (localStorage), with backup export/import\n" : "- Monetization model + price point\n"}- Onboarding, empty states, and the "first 60 seconds" experience
- If a SITE & APP AUDIT is given: a "Fixes" line mapping every must-fix item and customer complaint to a concrete feature
- If the app serves a business with customers: BOTH a customer side and an owner/staff dashboard (bookings/orders/customers/stats/settings) with clearly fictional sample data
Keep under 650 words. Markdown bullet form.`,
          user: `${purposeBlock}USER REQUEST (single command — flesh it out completely):\n${userPrompt}\n\n${visualBlock}${auditBlock}${marketBrief ? `COMPETITIVE BRIEF (live web research — build to beat these):\n${marketBrief}\n\n` : ""}${currentCode ? "EXISTING CODE TO ITERATE ON (preserve intent):\n" + currentCode.slice(0, 4000) : ""}`,
          images: [...images, ...visualImages].slice(0, 4),
        });
        send("stage", { stage: "architect", message: "Architecture ready", detail: architecture.slice(0, 600) });

        // === STAGE 2: BACKEND + DESIGN PLAN (parallel multi-agent) ===
        send("stage", { stage: "backend", message: "Backend agent + Design agent working in parallel…" });
        const [backend, designPlan] = await Promise.all([
          callAI({
            apiKey, userId: auth.user.id,
            model: MODEL_PRIMARY,
            reasoning: "medium",
            system: `You are a senior backend engineer. Given the architecture, write the complete BACKEND LAYER as a self-contained <script> block intended to be embedded in a single HTML file.
Include:
- LocalStorage-backed data store with CRUD helpers per entity
- Mock REST-style async functions (api.get/post/put/delete) returning Promises
${personal ? "- Backup helpers: export all data as a JSON file and import it back" : "- Stripe Checkout helper stub (window.openCheckout) if monetized"}
- Auth stub (sign in/up via localStorage or Supabase if hinted)
- Analytics queue (window.track)
- Error/event bus
Output ONE <script id="backend"> ... </script> block ONLY. No commentary.`,
            user: `${purposeBlock}ARCHITECTURE:\n${architecture}`,
          }),
          callAI({
            apiKey, userId: auth.user.id,
            model: MODEL_FAST,
            reasoning: "low",
            system: `You are a senior product designer + copywriter. From the architecture, output a tight DESIGN & COPY PLAN the frontend agent will execute. Include:
- Color palette (3-5 hex), typography pair, motion principles
- Section order with one-line purpose each
- Hero headline + subhead, primary CTA label
- 3-6 feature cards (title + 1-line value prop)
${personal ? "- 4 short \"how to\" tips for the member (no testimonials, no sales pitch)" : "- 3 testimonial stubs, 4 FAQ Q/A"}
- Empty/error/loading state copy
- Footer links
Markdown bullets, < 400 words, no preamble.`,
            user: `${purposeBlock}ARCHITECTURE:\n${architecture}\n\n${visualBlock}${auditBlock}USER REQUEST:\n${userPrompt}`,
          }),
        ]);
        send("stage", { stage: "backend", message: "Backend + Design plan complete" });

        // === STAGE 3: FRONTEND skeleton ===
        send("stage", { stage: "frontend", message: "Constructing frontend frame…" });
        const frontend = await callAI({
          apiKey, userId: auth.user.id,
          model: MODEL_PRIMARY,
          reasoning: "medium",
          system: `You are a senior frontend engineer. Build a COMPLETE single-file HTML app skeleton wired to the provided backend script and following the design plan.
Requirements:
- <!DOCTYPE html> with <html lang="en">
- Proper SEO <head>: title, meta description, Open Graph, Twitter, JSON-LD WebApplication schema
- PWA manifest as data: URL link, basic service worker registration with inline blob
- TailwindCSS via CDN (https://cdn.tailwindcss.com) configured with the palette and fonts from the VISUAL DESIGN BRIEF if one is given; otherwise a dark glass theme (bg #0a0a0a, primary gold #f59e0b)
- Mobile-first responsive layout, semantic HTML (header/main/section/footer), accessible (aria, alt)
- Include the backend <script> EXACTLY as given, then a <script id="app"> that renders all sections defined in the architecture
- Include all routes/sections (single-page nav)
- Include floating "Ask AI" chat bubble stub
${personal ? "- NO paywall, pricing, checkout, adverts or marketing landing page — open straight into the working app" : "- Include social share, paywall UI if monetized"}
- <meta name="oracle-lunar-app-config" content='{"purpose":"${purpose}","paid":${personal ? "false" : "..."},"price":"...","play_ready":true,"pwa":true,"social":true,"ai":true,"version":3}'>
Output ONLY the complete HTML document, no markdown fences, no commentary.`,
          user: `${purposeBlock}ARCHITECTURE:\n${architecture}\n\n${visualBlock}DESIGN & COPY PLAN:\n${designPlan}\n\nBACKEND SCRIPT:\n${backend}`,
        });
        let code = extractCode(frontend) || frontend.trim();
        if (!/<!doctype/i.test(code)) {
          throw new Error("Frontend stage did not return valid HTML");
        }
        send("stage", { stage: "frontend", message: "Frontend frame standing" });
        send("partial", { code });

        // emit partial so the live preview can show frame as soon as it stands
        send("partial", { code });

        // === STAGE 4: FLESH OUT ===
        send("stage", { stage: "flesh", message: "Fleshing out content, copy, and interactions…" });
        const fleshed = await callAI({
          apiKey, userId: auth.user.id,
          model: MODEL_PRIMARY,
          reasoning: "high",
          system: `You are a product designer + copywriter + senior engineer. Take the HTML and FLESH IT OUT to production quality:
- Replace ALL placeholder text with real, on-brand, useful copy
${personal ? "- This is a personal-use app: open straight into the tool, no hero/testimonials/pricing/marketing sections; add a short help panel instead" : "- Add hero, features grid, testimonials, FAQ, CTA, footer (only those that fit the app)"}
- Wire every button to real handlers using the backend
- Add micro-interactions (hover, focus, smooth transitions, loading states)
- Add empty states, error states, toasts
- Ensure 60fps and no layout shift
- Keep file size reasonable
Output ONLY the complete updated HTML document. No markdown fences. No commentary.`,
          user: `${visualBlock ? visualBlock + "Match that visual style closely (layout, palette, typography, imagery type) while keeping everything original.\n\n" : ""}${auditBlock ? auditBlock + "Make sure every must-fix item is a visible, working feature.\n\n" : ""}CURRENT HTML (improve in place):\n${code}`,
        });
        const fleshedCode = extractCode(fleshed) || fleshed.trim();
        if (/<!doctype/i.test(fleshedCode)) code = fleshedCode;
        send("stage", { stage: "flesh", message: "Content fleshed out" });
        send("partial", { code });

        // === STAGE 4b: COPYWRITER agent — eradicate generic/placeholder copy ===
        send("stage", { stage: "copywriter", message: "Copywriter agent rewriting every placeholder into real copy…" });
        const copyPass = await callAI({
          apiKey, userId: auth.user.id, model: MODEL_PRIMARY, reasoning: "medium",
          system: `You are a senior conversion copywriter. Scan the HTML and REPLACE every weak, generic, or placeholder phrase with sharp, specific, on-brand copy that a paying customer would respect.
ZERO TOLERANCE for: "Lorem ipsum", "Your text here", "Placeholder", "Sample", "TODO", "Coming soon" (unless the feature is genuinely roadmap), "Lipsum", "Click here", "Learn more" without context, single-word buttons that aren't action verbs, vague headlines like "Welcome to our app".
${personal ? "This is a PERSONAL-USE app: write friendly, plain, helpful labels and tips. NO testimonials, company stats, sales CTAs, trials or pricing." : "Add: real testimonials with names + roles + cities, real-sounding company stats, concrete benefits with numbers, clear CTAs (\"Start my 7-day trial\", \"Book a free 15-min consult\"), founder note, trust line."}
Never reuse wording, slogans, brand or product names from any inspiration website — all copy must be original.
Preserve ALL existing JS, IDs, classes, structure, and the <meta name="oracle-lunar-app-config"> tag. Only rewrite visible text content.
Output ONLY the complete HTML document. No fences. No commentary.`,
          user: `HTML:\n${code}`,
        });
        const copyCode = extractCode(copyPass) || copyPass.trim();
        if (/<!doctype/i.test(copyCode)) code = copyCode;
        send("stage", { stage: "copywriter", message: "All placeholder copy replaced with production wording" });
        send("partial", { code });

        // === STAGE 4c: ASSETS agent — fill every missing image / icon ===
        send("stage", { stage: "assets", message: "Assets agent wiring real images, icons, and OG art…" });
        const assetPass = await callAI({
          apiKey, userId: auth.user.id, model: MODEL_FAST, reasoning: "low",
          system: `You are an asset director. Scan the HTML for ANY <img> with empty/placeholder/broken src, missing alt, missing favicon, missing og:image, missing apple-touch-icon, or empty avatar circles.
Replace with real working URLs from these CDNs ONLY (allow-listed):
- https://images.unsplash.com/...?auto=format&fit=crop&w=...&q=80  (use real Unsplash photo IDs you know)
- https://picsum.photos/seed/<keyword>/<w>/<h>  (deterministic stock)
- https://api.dicebear.com/7.x/avataaars/svg?seed=<name>  (avatars)
- https://api.iconify.design/<set>/<icon>.svg  (icons)
Pick subjects that match the app theme${visualBrief ? " and the kind of pictures described in the visual brief (same mood and type, never the original photos or logos)" : ""}. Add descriptive alt text on every image. Ensure favicon, og:image, apple-touch-icon, and a manifest icon are all set (data: SVG is fine for favicon if needed).
Preserve all other markup, scripts, and IDs. Output ONLY the complete HTML document.`,
          user: `${visualBrief ? `VISUAL BRIEF (picture style to match):\n${visualBrief.slice(0, 2500)}\n\n` : ""}HTML:\n${code}`,
        });
        const assetCode = extractCode(assetPass) || assetPass.trim();
        if (/<!doctype/i.test(assetCode)) code = assetCode;
        send("stage", { stage: "assets", message: "Images, icons, and OG art in place" });
        send("partial", { code });

        // === STAGE 4d: MARKETING agent — Play Store listing baked in (apps to sell only) ===
        if (!personal) {
        send("stage", { stage: "marketing", message: "Marketing agent generating Play Store listing + share assets…" });
        const marketing = await callAI({
          apiKey, userId: auth.user.id, model: MODEL_FAST, reasoning: "low",
          system: `You are an ASO/Play Store specialist. From the HTML, output a single JSON object with these exact keys (no preamble):
{"title":"<≤30 chars>","short_description":"<≤80 chars>","full_description":"<≤4000 chars, persuasive, with bullet feature list>","keywords":["..."],"category":"<Play category>","content_rating":"<Everyone|Teen|Mature 17+>","price_tier":"<free|$0.99|$2.99|$4.99|$9.99|subscription>","privacy_summary":"<2 sentences>","support_email":"support@example.com"}
Output ONLY valid JSON. No markdown.`,
          user: `HTML:\n${code.slice(0, 30000)}`,
        });
        try {
          const listing = JSON.parse(marketing.match(/\{[\s\S]*\}/)?.[0] || "{}");
          const tag = `<script type="application/json" id="play-store-listing">${JSON.stringify(listing).replace(/</g, "\\u003c")}</script>`;
          if (!/id="play-store-listing"/.test(code)) {
            code = code.replace(/<\/body>/i, `${tag}\n</body>`);
          }
        } catch { /* ignore bad JSON */ }
        send("stage", { stage: "marketing", message: "Play Store listing embedded (visible in the published HTML)" });
        send("partial", { code });
        }

        // === STAGE 5+: SMOKE TEST → FIX loop ===
        for (let attempt = 1; attempt <= MAX_FIX_LOOPS; attempt++) {
          send("stage", { stage: "smoke", message: `Smoke testing (pass ${attempt}/${MAX_FIX_LOOPS})…` });
          const report = await callAI({
            apiKey, userId: auth.user.id,
            model: MODEL_FAST,
            reasoning: "medium",
            system: `You are a strict QA engineer. Statically analyze the provided HTML for runtime/render bugs. Check:
- Valid <!DOCTYPE html> and matching tags
- All referenced JS functions exist
- No undefined variables, no typos in element IDs used by JS
- All onclick / addEventListener handlers resolve
- Tailwind CDN present, no missing classes that break layout
- No empty hrefs, broken nav, dead buttons
- JSON.parse safe, try/catch around storage
- Service worker registration safe-guarded
- No CSP violations from inline (single-file is OK)
Respond with EXACTLY one of:
PASS
or
FAIL
<numbered list of concrete issues, each with a specific fix instruction>`,
            user: `HTML TO TEST (truncated if huge):\n${code.slice(0, 60000)}`,
          });
          const pass = /^\s*PASS\b/i.test(report.trim());
          send("stage", {
            stage: "smoke",
            message: pass ? "Smoke test PASSED ✓" : "Issues found — auto-fixing…",
            detail: report.slice(0, 800),
          });
          if (pass) break;
          if (attempt === MAX_FIX_LOOPS) {
            send("stage", { stage: "smoke", message: "Max fix loops reached — shipping best version" });
            break;
          }
          // === RESEARCH (web) — find real solutions for the QA issues ===
          let researchBlock = "";
          let researchSources: { url: string; title?: string }[] = [];
          try {
            send("stage", { stage: "research", message: "Searching the web for solutions…" });
            // Ask the fast model to turn the QA report into a concise search query.
            const queryRaw = await callAI({
              apiKey, userId: auth.user.id, model: MODEL_FAST, reasoning: "minimal",
              system: `Turn this QA bug report into ONE Google search query (max 12 words) that would find a fix or a library that solves it. Output ONLY the query, no quotes, no preamble.`,
              user: report.slice(0, 2000),
            });
            const query = queryRaw.split("\n")[0].trim().replace(/^["']|["']$/g, "").slice(0, 200);
            if (query) {
              const research = await webResearch(query, auth.user.id);
              researchBlock = research.summary;
              researchSources = research.sources;
              send("stage", {
                stage: "research",
                message: research.sources.length ? `Found ${research.sources.length} sources` : "No useful results — fixing from training knowledge",
                detail: query,
                sources: research.sources,
              });
            }
          } catch (e) {
            if (e instanceof InsufficientCoinsError || e instanceof PlanRequiredError) throw e;
            send("stage", { stage: "research", message: `Research skipped (${e instanceof Error ? e.message : "error"})` });
          }

          // FIX (with research + permission to add safe libraries via CDN)
          send("stage", { stage: "fix", message: `Applying fixes (pass ${attempt})…` });
          const fixed = await callAI({
            apiKey, userId: auth.user.id,
            model: MODEL_PRIMARY,
            reasoning: "high",
            system: `You are a senior engineer fixing a production single-file HTML app.
Apply ALL the QA issues listed. Preserve everything that works.

YOU ARE ALLOWED TO PULL IN ANY LIBRARY OR DEPENDENCY YOU NEED, as long as:
- It is loaded from a public CDN on this allow-list: ${SAFE_CDN_HOSTS.join(", ")}
- It is a legitimate open-source library (no warez, cracked, or obfuscated payloads)
- It does NOT attempt to access the host system, exfiltrate data, bypass auth, or contact suspicious endpoints
- All <script src> and <link href> tags use https://

If web research notes are provided below, use them — cite the helpful one(s) in an HTML comment at the top like <!-- fix-source: <url> -->.

Output ONLY the complete fixed HTML document. No markdown fences. No commentary.`,
            user: `QA REPORT:\n${report}\n\n${researchBlock ? `WEB RESEARCH (live, may help):\n${researchBlock}\n\n` : ""}CURRENT HTML:\n${code}`,
          });
          const fixedCode = extractCode(fixed) || fixed.trim();
          if (/<!doctype/i.test(fixedCode)) { code = fixedCode; send("partial", { code }); }

          // Re-emit sources so the UI can show them in the build log.
          if (researchSources.length) send("research_sources", { sources: researchSources });
        }

        // === STAGE 6: SHIP-READY HARDENING ===
        // Last pass: everything that stands between "demo" and "you can put this
        // in front of paying users / submit it to a store today".
        send("stage", { stage: "ship", message: personal ? "Ready-to-use pass — onboarding, backup, privacy, offline, install on your phone…" : "Ship-ready pass — onboarding, legal, SEO, PWA, analytics, payments…" });
        const shipped = await callAI({
          apiKey, userId: auth.user.id, model: MODEL_PRIMARY, reasoning: "high",
          system: personal ? `You are a senior engineer finishing a PERSONAL-USE app for one member (and maybe their family/team). Make it READY TO USE EVERY DAY. Add anything missing:
- First-run guided setup and a "how it works" help panel
- Working settings, backup export/import (JSON file) and delete-my-data control (localStorage backed)
- Installable PWA (manifest data URL, icons, offline-safe service worker), apple-touch-icon; works offline
- Accessibility: keyboard nav, focus rings, aria labels, colour contrast, prefers-reduced-motion
- Error handling, offline banner, loading states, toast system
- A short privacy note saying data stays on this device
- A version string and build date in the footer
Do NOT add pricing, paywalls, checkout, adverts, analytics trackers, cookie banners, testimonials or marketing pages.
Preserve all existing working logic, IDs, and the oracle-lunar-app-config meta (bump its "version" and add "ship_ready":true).
Output ONLY the complete HTML document. No fences. No commentary.` : `You are a launch engineer. Take the HTML and make it SHIP-READY — a real product a stranger could use and pay for today. Add anything missing:
- First-run onboarding / guided empty state, and a persistent "how it works" entry point
- Working settings, data export, and delete-my-data control (localStorage backed)
- Privacy Policy, Terms, and Contact sections (real readable copy, in-page routes/modals)
- Cookie/consent notice if any tracking exists
- Full SEO head (title, description, canonical, OG, Twitter, JSON-LD), sitemap-friendly semantic markup
- Installable PWA (manifest data URL, icons, offline-safe service worker), apple-touch-icon
- Accessibility: keyboard nav, focus rings, aria labels, colour contrast, prefers-reduced-motion
- Monetization actually wired: pricing section, paywall gate, checkout stub, restore/manage
- Error boundary, offline banner, loading skeletons, toast system
- Analytics event calls on every primary action
- A version string and build date in the footer
Preserve all existing working logic, IDs, and the oracle-lunar-app-config meta (bump its "version" and add "ship_ready":true).
Output ONLY the complete HTML document. No fences. No commentary.`,
          user: `HTML:\n${code}`,
        });
        const shippedCode = extractCode(shipped) || shipped.trim();
        if (/<!doctype/i.test(shippedCode)) code = shippedCode;
        send("partial", { code });

        // Launch checklist the user can actually act on.
        let shipChecklist = "";
        try {
          shipChecklist = await callAI({
            apiKey, userId: auth.user.id, model: MODEL_FAST, reasoning: "low",
            system: personal
              ? `Output a short READY-TO-USE CHECKLIST in markdown for a personal app: what is already DONE inside the build (tick list) and 2-4 simple next steps for the member (e.g. "Add it to your phone's home screen", "Make a backup each week"). Max 180 words. Plain words. No preamble.`
              : `You are a launch manager. Output a SHIP CHECKLIST for this app in markdown: what is already DONE inside the build (tick list) and the SHORT list of things only a human can do (domain, store account, real Stripe keys, screenshots). Max 250 words. No preamble.`,
            user: `HTML HEAD + CONFIG:\n${code.slice(0, 12000)}`,
          });
        } catch { /* optional */ }
        send("stage", { stage: "ship", message: "Ship-ready ✓ — launch checklist generated", detail: shipChecklist.slice(0, 800) });

        // === DONE ===
        send("done", {
          code,
          architecture: architecture.slice(0, 1200),
          marketBrief: marketBrief.slice(0, 1500),
          visualBrief: visualBrief.slice(0, 2500),
          siteAudit: siteAudit.slice(0, 3500),
          shipChecklist: shipChecklist.slice(0, 2000),
          purpose,
          sources: marketSources,
        });
        controller.close();
      } catch (err) {
        if (err instanceof PlanRequiredError) {
          send("error", { message: "The App Builder is part of the Pro plan. Upgrade to use it.", code: "plan_required", required_plan: err.required_plan });
          controller.close();
          return;
        }
        if (err instanceof InsufficientCoinsError) {
          send("error", {
            message: "Not enough coins. Top up your wallet to continue.",
            code: "insufficient_coins",
            needed_cents: err.needed_cents,
            balance_cents: err.balance_cents,
          });
          controller.close();
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        console.error("autonomous builder error", msg);
        send("error", { message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
