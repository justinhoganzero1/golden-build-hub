// Autonomous multi-stage app builder.
// Pipeline: ARCHITECT -> BACKEND -> FRONTEND -> FLESH -> SMOKE TEST -> FIX (loop up to N) -> FINAL
// Streams Server-Sent Events with stage updates and the final HTML code.
// Uses Lovable AI Gateway (no extra API key required).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

async function webResearch(query: string): Promise<{ summary: string; sources: { url: string; title?: string }[] }> {
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
    const arr = d?.data || d?.web?.results || [];
    const sources = (Array.isArray(arr) ? arr : []).slice(0, 4).map((s: any) => ({
      url: s.url, title: s.title,
      md: (s.markdown || s.description || "").slice(0, 2500),
    }));
    const summary = sources.map((s: any, i: number) => `[${i + 1}] ${s.title || s.url}\n${s.url}\n${s.md}`).join("\n\n---\n\n") || "(no results)";
    return { summary, sources: sources.map(({ url, title }) => ({ url, title })) };
  } catch (e) {
    return { summary: `(web research failed: ${e instanceof Error ? e.message : String(e)})`, sources: [] };
  }
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
}): Promise<string> {
  const { apiKey, system, user, model = MODEL_PRIMARY, reasoning = "medium", images = [] } = opts;

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
  return data?.choices?.[0]?.message?.content ?? "";
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

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: { prompt?: string; images?: string[]; currentCode?: string } = {};
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
        // === STAGE 1: ARCHITECT ===
        send("stage", { stage: "architect", message: "Designing app architecture & framework…" });
        const architecture = await callAI({
          apiKey,
          model: MODEL_PRIMARY,
          reasoning: "high",
          system: `You are a principal software architect. Output ONLY a concise, dense spec (no preamble, no closing) covering:
- App name & tagline
- Core user flows (numbered, max 8)
- Page sections / routes
- Data model (fields per entity)
- Backend endpoints / mock APIs (since output must be single-file HTML, design as in-page JS modules + localStorage persistence)
- Third-party APIs needed (Stripe, Web Speech, etc.)
- Visual style (colors, typography, motion)
- Monetization model
Keep under 500 words. Markdown bullet form.`,
          user: `USER REQUEST:\n${userPrompt}\n\n${currentCode ? "EXISTING CODE TO ITERATE ON (preserve intent):\n" + currentCode.slice(0, 4000) : ""}`,
          images,
        });
        send("stage", { stage: "architect", message: "Architecture ready", detail: architecture.slice(0, 600) });

        // === STAGE 2: BACKEND + DESIGN PLAN (parallel multi-agent) ===
        send("stage", { stage: "backend", message: "Backend agent + Design agent working in parallel…" });
        const [backend, designPlan] = await Promise.all([
          callAI({
            apiKey,
            model: MODEL_PRIMARY,
            reasoning: "medium",
            system: `You are a senior backend engineer. Given the architecture, write the complete BACKEND LAYER as a self-contained <script> block intended to be embedded in a single HTML file.
Include:
- LocalStorage-backed data store with CRUD helpers per entity
- Mock REST-style async functions (api.get/post/put/delete) returning Promises
- Stripe Checkout helper stub (window.openCheckout) if monetized
- Auth stub (sign in/up via localStorage or Supabase if hinted)
- Analytics queue (window.track)
- Error/event bus
Output ONE <script id="backend"> ... </script> block ONLY. No commentary.`,
            user: `ARCHITECTURE:\n${architecture}`,
          }),
          callAI({
            apiKey,
            model: MODEL_FAST,
            reasoning: "low",
            system: `You are a senior product designer + copywriter. From the architecture, output a tight DESIGN & COPY PLAN the frontend agent will execute. Include:
- Color palette (3-5 hex), typography pair, motion principles
- Section order with one-line purpose each
- Hero headline + subhead, primary CTA label
- 3-6 feature cards (title + 1-line value prop)
- 3 testimonial stubs, 4 FAQ Q/A
- Empty/error/loading state copy
- Footer links
Markdown bullets, < 400 words, no preamble.`,
            user: `ARCHITECTURE:\n${architecture}\n\nUSER REQUEST:\n${userPrompt}`,
          }),
        ]);
        send("stage", { stage: "backend", message: "Backend + Design plan complete" });

        // === STAGE 3: FRONTEND skeleton ===
        send("stage", { stage: "frontend", message: "Constructing frontend frame…" });
        const frontend = await callAI({
          apiKey,
          model: MODEL_PRIMARY,
          reasoning: "medium",
          system: `You are a senior frontend engineer. Build a COMPLETE single-file HTML app skeleton wired to the provided backend script and following the design plan.
Requirements:
- <!DOCTYPE html> with <html lang="en">
- Proper SEO <head>: title, meta description, Open Graph, Twitter, JSON-LD WebApplication schema
- PWA manifest as data: URL link, basic service worker registration with inline blob
- TailwindCSS via CDN (https://cdn.tailwindcss.com) configured for dark glass theme (bg #0a0a0a, primary gold #f59e0b)
- Mobile-first responsive layout, semantic HTML (header/main/section/footer), accessible (aria, alt)
- Include the backend <script> EXACTLY as given, then a <script id="app"> that renders all sections defined in the architecture
- Include all routes/sections (single-page nav)
- Include floating "Ask AI" chat bubble stub
- Include social share, paywall UI if monetized
- <meta name="oracle-lunar-app-config" content='{"paid":...,"price":"...","play_ready":true,"pwa":true,"social":true,"ai":true,"version":3}'>
Output ONLY the complete HTML document, no markdown fences, no commentary.`,
          user: `ARCHITECTURE:\n${architecture}\n\nDESIGN & COPY PLAN:\n${designPlan}\n\nBACKEND SCRIPT:\n${backend}`,
        });
        let code = extractCode(frontend) || frontend.trim();
        if (!/<!doctype/i.test(code)) {
          throw new Error("Frontend stage did not return valid HTML");
        }
        send("stage", { stage: "frontend", message: "Frontend frame standing" });

        // emit partial so the live preview can show frame as soon as it stands
        send("partial", { code });

        // === STAGE 4: FLESH OUT ===
        send("stage", { stage: "flesh", message: "Fleshing out content, copy, and interactions…" });
        const fleshed = await callAI({
          apiKey,
          model: MODEL_PRIMARY,
          reasoning: "high",
          system: `You are a product designer + copywriter + senior engineer. Take the HTML and FLESH IT OUT to production quality:
- Replace ALL placeholder text with real, on-brand, useful copy
- Add hero, features grid, testimonials, FAQ, CTA, footer (only those that fit the app)
- Wire every button to real handlers using the backend
- Add micro-interactions (hover, focus, smooth transitions, loading states)
- Add empty states, error states, toasts
- Ensure 60fps and no layout shift
- Keep file size reasonable
Output ONLY the complete updated HTML document. No markdown fences. No commentary.`,
          user: `CURRENT HTML (improve in place):\n${code}`,
        });
        const fleshedCode = extractCode(fleshed) || fleshed.trim();
        if (/<!doctype/i.test(fleshedCode)) code = fleshedCode;
        send("stage", { stage: "flesh", message: "Content fleshed out" });
        send("partial", { code });

        // === STAGE 4b: COPYWRITER agent — eradicate generic/placeholder copy ===
        send("stage", { stage: "copywriter", message: "Copywriter agent rewriting every placeholder into real copy…" });
        const copyPass = await callAI({
          apiKey, model: MODEL_PRIMARY, reasoning: "medium",
          system: `You are a senior conversion copywriter. Scan the HTML and REPLACE every weak, generic, or placeholder phrase with sharp, specific, on-brand copy that a paying customer would respect.
ZERO TOLERANCE for: "Lorem ipsum", "Your text here", "Placeholder", "Sample", "TODO", "Coming soon" (unless the feature is genuinely roadmap), "Lipsum", "Click here", "Learn more" without context, single-word buttons that aren't action verbs, vague headlines like "Welcome to our app".
Add: real testimonials with names + roles + cities, real-sounding company stats, concrete benefits with numbers, clear CTAs ("Start my 7-day trial", "Book a free 15-min consult"), founder note, trust line.
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
          apiKey, model: MODEL_FAST, reasoning: "low",
          system: `You are an asset director. Scan the HTML for ANY <img> with empty/placeholder/broken src, missing alt, missing favicon, missing og:image, missing apple-touch-icon, or empty avatar circles.
Replace with real working URLs from these CDNs ONLY (allow-listed):
- https://images.unsplash.com/...?auto=format&fit=crop&w=...&q=80  (use real Unsplash photo IDs you know)
- https://picsum.photos/seed/<keyword>/<w>/<h>  (deterministic stock)
- https://api.dicebear.com/7.x/avataaars/svg?seed=<name>  (avatars)
- https://api.iconify.design/<set>/<icon>.svg  (icons)
Pick subjects that match the app theme. Add descriptive alt text on every image. Ensure favicon, og:image, apple-touch-icon, and a manifest icon are all set (data: SVG is fine for favicon if needed).
Preserve all other markup, scripts, and IDs. Output ONLY the complete HTML document.`,
          user: `HTML:\n${code}`,
        });
        const assetCode = extractCode(assetPass) || assetPass.trim();
        if (/<!doctype/i.test(assetCode)) code = assetCode;
        send("stage", { stage: "assets", message: "Images, icons, and OG art in place" });
        send("partial", { code });

        // === STAGE 4d: MARKETING agent — Play Store listing baked in ===
        send("stage", { stage: "marketing", message: "Marketing agent generating Play Store listing + share assets…" });
        const marketing = await callAI({
          apiKey, model: MODEL_FAST, reasoning: "low",
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

        // === STAGE 5+: SMOKE TEST → FIX loop ===
        for (let attempt = 1; attempt <= MAX_FIX_LOOPS; attempt++) {
          send("stage", { stage: "smoke", message: `Smoke testing (pass ${attempt}/${MAX_FIX_LOOPS})…` });
          const report = await callAI({
            apiKey,
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
              apiKey, model: MODEL_FAST, reasoning: "minimal",
              system: `Turn this QA bug report into ONE Google search query (max 12 words) that would find a fix or a library that solves it. Output ONLY the query, no quotes, no preamble.`,
              user: report.slice(0, 2000),
            });
            const query = queryRaw.split("\n")[0].trim().replace(/^["']|["']$/g, "").slice(0, 200);
            if (query) {
              const research = await webResearch(query);
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
            send("stage", { stage: "research", message: `Research skipped (${e instanceof Error ? e.message : "error"})` });
          }

          // FIX (with research + permission to add safe libraries via CDN)
          send("stage", { stage: "fix", message: `Applying fixes (pass ${attempt})…` });
          const fixed = await callAI({
            apiKey,
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
          if (/<!doctype/i.test(fixedCode)) code = fixedCode;

          // Re-emit sources so the UI can show them in the build log.
          if (researchSources.length) send("research_sources", { sources: researchSources });
        }

        // === DONE ===
        send("done", { code, architecture: architecture.slice(0, 1200) });
        controller.close();
      } catch (err) {
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
