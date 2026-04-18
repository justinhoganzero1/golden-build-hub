// Claims Assistant: research claim requirements + draft claim letter
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkJailbreak } from "../_shared/jailbreakGuard.ts";

const ADMIN_EMAIL = "justinbretthogan@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

const PROVIDER_INFO: Record<string, { name: string; phone: string; sites: string[]; query: string }> = {
  hostplus: {
    name: "HostPlus Super",
    phone: "1300 467 875",
    sites: ["https://hostplus.com.au"],
    query: "HostPlus income protection insurance claim form requirements documents",
  },
  workcover_qld: {
    name: "WorkCover Queensland",
    phone: "1300 362 128",
    sites: ["https://www.worksafe.qld.gov.au", "https://www.workcoverqld.com.au"],
    query: "WorkCover Queensland application for compensation form lodge claim requirements",
  },
};

async function research(provider: string) {
  const info = PROVIDER_INFO[provider];
  if (!info || !FIRECRAWL_API_KEY) return { provider: info?.name ?? provider, links: [], summary: "" };
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: info.query, limit: 5 }),
    });
    const data = await r.json().catch(() => ({}));
    const results = (data?.data || data?.web || []).slice(0, 5).map((x: any) => ({
      title: x.title, url: x.url, description: x.description,
    }));
    return { provider: info.name, phone: info.phone, links: results };
  } catch (e) {
    return { provider: info.name, phone: info.phone, links: [], error: String(e) };
  }
}

async function draftLetter(claim: any, research: any) {
  if (!LOVABLE_API_KEY) throw new Error("AI not configured");
  const sys = `You are a senior Australian insurance claims advocate. Draft a clear, factual, professional claim letter to ${research.provider}. 
Use only facts the user provided. Mark any unknown field as [TO CONFIRM]. Include: claimant details, member/claim numbers, injury date and description, employer & last day worked, treating doctor, request for assessment, and contact info. Plain text, no markdown.`;
  const userMsg = `Claim type: ${claim.claim_type}\nProvider: ${research.provider}\n\nCLAIMANT DATA:\n${JSON.stringify(claim, null, 2)}\n\nRELEVANT RESOURCES:\n${(research.links || []).map((l: any) => `- ${l.title}: ${l.url}`).join("\n")}`;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
    }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claimsAuth } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
    if (!claimsAuth?.claims) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const { action, claim_id, provider = "hostplus", claim_data } = body;

    // ── Jailbreak guard on any free-text fields the user submits ──
    const userId = (claimsAuth.claims.sub as string) ?? null;
    const userEmail = (claimsAuth.claims.email as string) ?? null;
    const isOwner = userEmail?.toLowerCase() === ADMIN_EMAIL;
    const probe = [
      claim_data?.injury_description,
      claim_data?.notes,
      claim_data?.body_parts,
    ].filter((x: any) => typeof x === "string" && x.length > 0).join("\n");
    if (probe) {
      const guard = await checkJailbreak({ userId, userEmail, isOwner, message: probe });
      if (guard.blocked) {
        return new Response(
          JSON.stringify({ error: "security_block", message: guard.message, deleted: guard.deleted }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (action === "research") {
      const res = await research(provider);
      return new Response(JSON.stringify(res), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "draft") {
      const res = await research(provider);
      const draft = await draftLetter(claim_data || {}, res);
      if (claim_id) {
        await supabase.from("user_claims").update({ ai_draft: draft, ai_research: res, status: "drafted" }).eq("id", claim_id);
      }
      return new Response(JSON.stringify({ draft, research: res }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
