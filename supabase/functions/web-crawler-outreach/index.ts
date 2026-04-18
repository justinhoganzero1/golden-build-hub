// SOLACE Web Crawler & Outreach — Admin-only growth engine.
// Uses Firecrawl (search/scrape/map) + Lovable AI to:
//  1) DISCOVER niche-relevant websites, blogs, directories, press contacts
//  2) DRAFT personalized outreach emails (press, partnerships, backlinks, AI-app directories)
//  3) Optionally LOG discovered prospects as inquiry_leads (source="crawler") so they appear
//     in the Owner Dashboard alongside concierge leads.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL = "https://api.firecrawl.dev/v2";
const LOVABLE_AI = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface Prospect {
  url: string;
  title?: string;
  description?: string;
  category?: string;
  contact_email?: string | null;
  outreach_subject?: string;
  outreach_body?: string;
}

async function firecrawlSearch(query: string, limit = 10) {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) throw new Error("FIRECRAWL_API_KEY missing");
  const r = await fetch(`${FIRECRAWL}/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Firecrawl search ${r.status}: ${JSON.stringify(d)}`);
  // v2 normalises results under data.web or data
  const items = d?.data?.web ?? d?.data ?? d?.results ?? [];
  return Array.isArray(items) ? items : [];
}

async function firecrawlScrape(url: string) {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return null;
  try {
    const r = await fetch(`${FIRECRAWL}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    const d = await r.json();
    if (!r.ok) return null;
    return (d?.data?.markdown ?? d?.markdown ?? "").slice(0, 8000);
  } catch { return null; }
}

function extractEmail(text: string): string | null {
  if (!text) return null;
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

async function aiDraft(prospect: { url: string; title?: string; description?: string; pageSummary?: string }, campaign: string) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return { subject: "", body: "" };
  const sys = `You are a world-class growth marketer for SOLACE — a cinematic AI super-app (40+ modules: Oracle AI, Crisis Hub, Movie Studio, Avatar Generator, Live Vision, AI Companion, Wallet, etc.). Live at https://oracle-lunar.online. Founder: Justin Hogan. Write SHORT, warm, specific outreach emails that get replies. Always reference something specific from the target site. Never sound templated. End with one clear ask.`;
  const user = `Campaign type: ${campaign}
Target site: ${prospect.url}
Title: ${prospect.title ?? ""}
Description: ${prospect.description ?? ""}
Page snippet:
${(prospect.pageSummary ?? "").slice(0, 2000)}

Return JSON ONLY: {"subject":"...","body":"..."} — body under 120 words, plain text, no markdown.`;
  try {
    const r = await fetch(LOVABLE_AI, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });
    const d = await r.json();
    const raw = d?.choices?.[0]?.message?.content || "";
    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { subject: `SOLACE × ${new URL(prospect.url).hostname}`, body: raw.slice(0, 600) };
    const parsed = JSON.parse(json);
    return { subject: parsed.subject || "", body: parsed.body || "" };
  } catch {
    return { subject: "", body: "" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();
    const action: string = body.action || "discover";
    const campaign: string = body.campaign || "press"; // press | partnership | directory | investor | backlink
    const niche: string = body.niche || "AI mental health super app";
    const limit: number = Math.min(Math.max(Number(body.limit) || 10, 1), 25);
    const logToLeads: boolean = !!body.logToLeads;

    // ----- DISCOVER -----
    if (action === "discover") {
      // Build smart queries per campaign
      const queries: Record<string, string[]> = {
        press: [
          `${niche} site:techcrunch.com OR site:theverge.com OR site:venturebeat.com`,
          `"AI app" review blog ${niche}`,
          `product hunt ${niche}`,
        ],
        partnership: [
          `${niche} partnership integration API`,
          `mental health app partnership program`,
          `wellness app affiliate program`,
        ],
        directory: [
          `AI app directory submit listing`,
          `mental health app directory`,
          `PWA directory submit ${niche}`,
        ],
        investor: [
          `AI startup angel investor blog`,
          `early stage AI investor newsletter`,
          `mental health tech VC fund`,
        ],
        backlink: [
          `"write for us" ${niche}`,
          `${niche} guest post`,
          `best AI apps 2025 listicle`,
        ],
      };
      const qList = queries[campaign] || [niche];
      const seen = new Set<string>();
      const prospects: Prospect[] = [];

      for (const q of qList) {
        const results = await firecrawlSearch(q, Math.ceil(limit / qList.length) + 2);
        for (const r of results) {
          const url = r.url || r.link;
          if (!url) continue;
          let host: string;
          try { host = new URL(url).hostname; } catch { continue; }
          if (seen.has(host)) continue;
          seen.add(host);
          prospects.push({
            url,
            title: r.title || r.name || host,
            description: r.description || r.snippet || "",
            category: campaign,
          });
          if (prospects.length >= limit) break;
        }
        if (prospects.length >= limit) break;
      }

      // Enrich top prospects: scrape page → extract email → draft outreach
      const enriched: Prospect[] = [];
      for (const p of prospects.slice(0, limit)) {
        const md = await firecrawlScrape(p.url);
        const email = md ? extractEmail(md) : null;
        const draft = await aiDraft(
          { url: p.url, title: p.title, description: p.description, pageSummary: md ?? "" },
          campaign,
        );
        enriched.push({
          ...p,
          contact_email: email,
          outreach_subject: draft.subject,
          outreach_body: draft.body,
        });
      }

      // Optionally log to inquiry_leads so they appear in the Owner Dashboard
      if (logToLeads) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceKey) {
          const sb = createClient(supabaseUrl, serviceKey);
          for (const p of enriched) {
            await sb.from("inquiry_leads").insert({
              name: p.title?.slice(0, 120) || new URL(p.url).hostname,
              email: p.contact_email,
              interest: `crawler:${campaign}`,
              message: `${p.url}\n\n${p.outreach_subject}\n\n${p.outreach_body}`,
              source: "crawler",
              ai_summary: p.description || null,
              status: "new",
            });
          }
        }
      }

      return new Response(JSON.stringify({ ok: true, campaign, count: enriched.length, prospects: enriched }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ----- SINGLE-URL OUTREACH (manual) -----
    if (action === "draft") {
      const url: string = body.url;
      if (!url) throw new Error("url required");
      const md = await firecrawlScrape(url);
      const email = md ? extractEmail(md) : null;
      const draft = await aiDraft({ url, pageSummary: md ?? "" }, campaign);
      return new Response(JSON.stringify({ ok: true, url, contact_email: email, ...draft }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[web-crawler-outreach]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
