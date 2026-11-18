// Owner-only Client Pitch Machine.
// Steps (each runs in the background, results saved on the pitch_projects row):
//   scan    -> desktop + phone screenshots, design colours/fonts, public contact
//              details, and what customers say online (Google, Trustpilot, Facebook, ProductReview)
//   analyse -> AI audit: what's missing, complaints, design brief, app concept
//   build   -> one offline demo file: new website + customer app + owner panel
//   pitch   -> glossy presentation slides + draft proposal email
// Nothing is emailed or published from here; the owner sends the email himself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.9";
import { z } from "npm:zod@3.25.76";
import { requireOwner } from "../_shared/requireAuth.ts";
import { cleanSiteUrl, summariseBranding } from "../_shared/visualSnapshot.ts";
import {
  extractContacts, mergeContacts, reviewQueries, parseJsonLoose, extractHtml, normaliseDeck,
  type FoundContacts,
} from "../_shared/pitchDemo.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODEL = "openai/gpt-6-astra" as const;
const BUCKET = "pitch-assets";
const STALE_MS = 12 * 60_000;
const RUNNING: Record<string, string> = { scan: "scanning", analyse: "analysing", build: "building", pitch: "pitching" };
const DONE: Record<string, string> = { scan: "scanned", analyse: "analysed", build: "built", pitch: "ready" };
const NEEDS: Record<string, string[]> = { scan: [], analyse: ["snapshot"], build: ["audit"], pitch: ["audit"] };

const bodySchema = z.object({
  action: z.literal("run_step"),
  id: z.string().uuid(),
  step: z.enum(["scan", "analyse", "build", "pitch"]),
});

const svc = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// ───────── Firecrawl (direct API, same key as App Builder) ─────────
async function firecrawl(path: string, body: Record<string, unknown>, timeoutMs = 70_000): Promise<any> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) throw new Error("Website reader is not connected");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`https://api.firecrawl.dev/v2/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d?.success === false) throw new Error(`Website reader ${r.status}: ${String(d?.error || "").slice(0, 200)}`);
    return d;
  } finally {
    clearTimeout(t);
  }
}

async function saveShot(supabase: ReturnType<typeof svc>, id: string, name: string, src?: string): Promise<string | undefined> {
  if (!src || typeof src !== "string") return undefined;
  try {
    let bytes: Uint8Array; let type = "image/png";
    if (src.startsWith("data:")) {
      const m = /^data:([^;]+);base64,(.*)$/.exec(src);
      if (!m) return undefined;
      type = m[1];
      bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    } else {
      const r = await fetch(src);
      if (!r.ok) return undefined;
      type = (r.headers.get("content-type") || type).split(";")[0];
      bytes = new Uint8Array(await r.arrayBuffer());
    }
    const path = `${id}/${name}.${type.includes("jpeg") ? "jpg" : "png"}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: true });
    if (error) console.error("screenshot save failed", error.message);
    return error ? undefined : path;
  } catch (e) {
    console.error("screenshot save failed", e);
    return undefined;
  }
}

// ───────── AI ─────────
function outputText(res: unknown): string {
  const r = res as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof r.output_text === "string" && r.output_text) return r.output_text;
  const parts: string[] = [];
  for (const item of r.output ?? []) for (const c of item.content ?? []) if (c.type === "output_text" && c.text) parts.push(c.text);
  return parts.join("");
}

async function ai(instructions: string, text: string, opts: { images?: string[]; effort?: "low" | "medium"; maxTokens?: number } = {}): Promise<string> {
  const content: any[] = [{ type: "input_text", text }];
  for (const url of opts.images ?? []) content.push({ type: "input_image", image_url: url, detail: "auto" });
  const res = await generateResponse({
    model: MODEL,
    instructions,
    input: [{ role: "user", content }],
    reasoning: { effort: opts.effort ?? "low" },
    ...(opts.maxTokens ? { max_output_tokens: opts.maxTokens } : {}),
  } as any, { maxRetries: 0 });
  const out = outputText(res);
  if (!out) throw new Error("The AI returned nothing");
  return out;
}

const LEGAL = `LEGAL RULES (always): never copy the business's logo, brand artwork, photos or written copy, and never use other companies' trademarks. Use the business's own name only to label the proposal. Write 100% original wording. Never invent reviews, awards, statistics or prices; when unsure write [TO CONFIRM]. Complaints must come only from the review text supplied, with the source named.`;

// ───────── Steps ─────────
async function stepScan(row: any) {
  const supabase = svc();
  const url = cleanSiteUrl(row.business_url);
  if (!url) throw new Error("That website link isn't a public web address");
  const host = new URL(url).hostname.replace(/^www\./, "");

  const [desk, mob] = await Promise.allSettled([
    firecrawl("scrape", { url, formats: [{ type: "screenshot", fullPage: false }, "branding", "markdown", "links"], onlyMainContent: false, waitFor: 1500 }),
    firecrawl("scrape", { url, formats: [{ type: "screenshot", fullPage: false }], mobile: true, waitFor: 1500 }),
  ]);
  if (desk.status === "rejected") throw new Error(`Couldn't open the website (${String(desk.reason?.message || desk.reason).slice(0, 160)})`);
  const d = desk.value?.data || {};
  const m = mob.status === "fulfilled" ? mob.value?.data || {} : {};

  const [desktopPath, mobilePath] = await Promise.all([
    saveShot(supabase, row.id, "desktop", d.screenshot),
    saveShot(supabase, row.id, "mobile", m.screenshot),
  ]);

  const links: string[] = Array.isArray(d.links) ? d.links.filter((l: unknown) => typeof l === "string") : [];
  let contacts: FoundContacts = extractContacts(String(d.markdown || ""), links, url);
  if (contacts.contactPage && contacts.contactPage !== url) {
    try {
      const c = await firecrawl("scrape", { url: contacts.contactPage, formats: ["markdown", "links"], onlyMainContent: false }, 45_000);
      const cd = c?.data || {};
      contacts = mergeContacts(contacts, extractContacts(String(cd.markdown || ""), Array.isArray(cd.links) ? cd.links : [], url));
    } catch { /* contact page optional */ }
  }

  const meta = d.metadata || {};
  const name = String(row.business_name || meta.ogSiteName || String(meta.title || "").split(/[|\-–—:]/)[0] || host).trim().slice(0, 100);

  const queries = reviewQueries(name, host);
  const results = await Promise.allSettled(queries.map((q) =>
    firecrawl("search", { query: q.query, limit: 3, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }, 60_000)
      .then((r) => ({ q, r }))
  ));
  const items: { source: string; url: string; title?: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const res of results) {
    if (res.status !== "fulfilled") continue;
    const arr = res.value.r?.data?.web || res.value.r?.data || [];
    for (const s of Array.isArray(arr) ? arr : []) {
      if (!s?.url || seen.has(s.url)) continue;
      seen.add(s.url);
      items.push({
        source: res.value.q.source,
        url: String(s.url),
        title: s.title ? String(s.title).slice(0, 200) : undefined,
        text: String(s.markdown || s.description || "").replace(/\s+/g, " ").slice(0, 2500),
      });
    }
  }

  return {
    business_name: name,
    snapshot: {
      url, title: meta.title || null, description: meta.description || null,
      desktop_path: desktopPath || null, mobile_path: mobilePath || null,
      branding: summariseBranding(d.branding),
      text_sample: String(d.markdown || "").slice(0, 5000),
      scanned_at: new Date().toISOString(),
    },
    contacts,
    reviews: { items: items.slice(0, 15), searched: queries.map((q) => q.source) },
  };
}

async function signed(path?: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  const { data } = await svc().storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl;
}

async function stepAnalyse(row: any) {
  const snap = row.snapshot || {};
  const images = (await Promise.all([signed(snap.desktop_path), signed(snap.mobile_path)])).filter(Boolean) as string[];
  const reviews = (row.reviews?.items || []).map((r: any, i: number) => `[${i + 1}] (${r.source}) ${r.url}\n${r.text}`).join("\n\n");
  const prompt = `BUSINESS: ${row.business_name}\nWEBSITE: ${snap.url}\nPAGE TITLE: ${snap.title || ""}\nDESIGN DATA: ${snap.branding || "(none)"}\n\nWEBSITE TEXT (start):\n${String(snap.text_sample || "").slice(0, 4500)}\n\nWHAT PEOPLE SAY ONLINE (search results):\n${reviews || "(no reviews found)"}\n\nThe attached pictures are the current website on desktop and phone.`;
  const instructions = `You are a senior web-agency strategist auditing a business's website to win them as a client.
Study the screenshots like a designer and the review text like a customer researcher.
${LEGAL}
Reply with ONLY a JSON object:
{"business":{"name":"","industry":"","what_they_do":"","customers":""},
 "current_site":{"score_out_of_10":0,"strengths":[""],"weaknesses":[""]},
 "complaints":[{"issue":"","evidence":"short paraphrase","source":"Trustpilot|Google reviews|Facebook|...","url":""}],
 "missing":[""],
 "opportunities":[""],
 "design_brief":{"style":"","palette":["#hex"],"fonts":"","layout":"","keep_from_current":"","do_not_copy":""},
 "app_concept":{"name":"original name","tagline":"","customer_features":[""],"owner_features":[""]}}
Review titles, star ratings and short snippets count as evidence: list every negative one as a complaint (paraphrased, with its source and url), including complaints about service, food, waiting, booking, prices or staff. Ignore results that are clearly about a different business or are job/employee reviews.
Max 6 items per list. Only if nothing negative appears, return "complaints": [] and say so in opportunities.`;
  const raw = await ai(instructions, prompt, { images, effort: "medium" });
  const audit = parseJsonLoose<Record<string, unknown>>(raw);
  if (!audit) throw new Error("The audit came back unreadable — run it again");
  return { audit };
}

async function stepBuild(row: any) {
  const a = row.audit || {};
  const instructions = `You build polished, fully working single-file HTML demos for web-agency proposals.
Output ONE complete HTML document only (<!DOCTYPE html> ... </html>), no explanations.
${LEGAL}
REQUIREMENTS:
- Tailwind via <script src="https://cdn.tailwindcss.com"></script> and Google Fonts are allowed. No other network use: no fetch/XHR, no external APIs, no forms that submit anywhere, no iframes. Everything works offline in the browser with realistic sample data and localStorage (wrap localStorage in try/catch and fall back to memory).
- A sticky top switcher with three views: "Website" (the new public website), "Customer App" (phone-style app for the business's customers) and "Owner Panel" (dashboard for the business owner).
- Website: hero, services/products, why choose us, fixes for every customer complaint, FAQ, contact section (button shows a "demo only" message instead of sending).
- Customer App: phone frame on desktop, full screen on phones; every customer_feature works (bookings/orders/loyalty/etc.).
- Owner Panel: every owner_feature works with sample data (bookings list, customers, stats chart in SVG/CSS, settings).
- Mobile first, accessible, beautiful, matching the design brief. Use emoji or inline SVG icons; pictures only from images.unsplash.com when needed.
- Leave 40px free at the bottom of the page for a demo notice bar.
- Directly answer each complaint and missing item with a visible feature.
- SAMPLE DATA: the demo must feel alive. Fill the Owner Panel and Customer App with plenty of clearly fictional sample records (e.g. 12+ bookings with made-up first names, times and party sizes, sample menu/service items, loyalty points, a filled weekly chart). The "never invent" rule applies to claims about the real business, not to obviously fictional demo records. Add a small "Sample data" label on the Owner Panel.
- Never show "[TO CONFIRM]" inside the demo; use friendly placeholders such as "Your opening hours" instead.`;
  const prompt = `Build the demo for this business.\n\nAUDIT JSON:\n${JSON.stringify(a).slice(0, 12000)}\n\nCurrent website for reference: ${row.snapshot?.url || row.business_url}`;
  const raw = await ai(instructions, prompt, { effort: "low", maxTokens: 40000 });
  const html = extractHtml(raw);
  if (!html || html.length < 2000) throw new Error("The demo came back incomplete — run Build again");
  return { demo_html: html };
}

async function stepPitch(row: any) {
  const a = row.audit || {};
  const instructions = `You write short, glossy, persuasive business proposals for a web agency called Oracle Lunar.
Focus on the business's CUSTOMERS' needs and how the new website + app fixes their complaints and grows the business.
${LEGAL}
Never include personal names or contact details of the agency owner. The proposal is signed "The Oracle Lunar team".
Reply with ONLY JSON:
{"slides":[
 {"kind":"title","title":"","subtitle":""},
 {"kind":"problem","title":"What your customers are telling you","bullets":[""],"quote":"short paraphrased customer complaint or empty"},
 {"kind":"missing","title":"What your website is missing","bullets":[""]},
 {"kind":"solution","title":"Your new website and app","subtitle":"","bullets":[""]},
 {"kind":"features","title":"Built for your customers — and for you","bullets":[""]},
 {"kind":"results","title":"What this means for your business","bullets":["benefits without invented numbers"]},
 {"kind":"next","title":"Next steps","bullets":["include the price if given, otherwise 'Pricing tailored to you'","the demo link stays open for 7 days"]}],
 "email":{"subject":"","body":"plain text, 120-180 words, friendly, Australian English, includes the demo link as {{DEMO_LINK}}, ends with 'The Oracle Lunar team'"}}`;
  const prompt = `AUDIT JSON:\n${JSON.stringify(a).slice(0, 10000)}\n\nPRICE TO QUOTE: ${row.offer_price || "(not given)"}\nBUSINESS: ${row.business_name}`;
  const raw = await ai(instructions, prompt, { effort: "low" });
  const parsed = parseJsonLoose<any>(raw);
  const slides = normaliseDeck(parsed);
  if (!slides.length) throw new Error("The presentation came back unreadable — run it again");
  const email = {
    subject: String(parsed?.email?.subject || `A new website and app for ${row.business_name}`).slice(0, 160),
    body: String(parsed?.email?.body || "").slice(0, 3000),
    to: row.contacts?.emails?.[0] || "",
  };
  return { deck: { slides }, email };
}

const RUNNERS: Record<string, (row: any) => Promise<Record<string, unknown>>> = {
  scan: stepScan, analyse: stepAnalyse, build: stepBuild, pitch: stepPitch,
};

async function runInBackground(id: string, step: string) {
  const supabase = svc();
  try {
    const { data: row } = await supabase.from("pitch_projects").select("*").eq("id", id).single();
    const result = await RUNNERS[step](row);
    await supabase.from("pitch_projects").update({ ...result, status: DONE[step], step: null, step_error: null }).eq("id", id);
  } catch (e) {
    const msg = e instanceof GatewayError
      ? (e.httpStatus === 402 ? "AI credits are used up" : e.httpStatus === 429 ? "AI is busy — try again in a minute" : `AI problem (${e.code})`)
      : e instanceof Error ? e.message : String(e);
    console.error("pitch-machine step failed", step, msg);
    await supabase.from("pitch_projects").update({ status: "failed", step: null, step_error: `${step}: ${msg}`.slice(0, 400) }).eq("id", id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireOwner(req);
  if (auth.response) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request" }, 400);
  const { id, step } = parsed.data;

  const supabase = svc();
  const { data: row, error } = await supabase.from("pitch_projects").select("id,status,step,step_started_at,snapshot,audit").eq("id", id).maybeSingle();
  if (error || !row) return json({ error: "Project not found" }, 404);

  const running = Object.values(RUNNING).includes(row.status);
  const fresh = row.step_started_at && Date.now() - new Date(row.step_started_at).getTime() < STALE_MS;
  if (running && fresh) return json({ error: "A step is already running" }, 409);
  for (const need of NEEDS[step]) if (!(row as any)[need]) return json({ error: `Run the earlier step first (${need})` }, 400);

  await supabase.from("pitch_projects").update({
    status: RUNNING[step], step, step_error: null, step_started_at: new Date().toISOString(),
  }).eq("id", id);

  EdgeRuntime.waitUntil(runInBackground(id, step));
  return json({ started: true, step }, 202);
});
