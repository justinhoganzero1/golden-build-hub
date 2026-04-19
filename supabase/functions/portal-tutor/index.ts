// ORACLE LUNAR Portal Concierge — streaming AI tutor for the marketing site.
// Public endpoint (no JWT). Uses Lovable AI Gateway.
// Also captures sales/contact inquiries to inquiry_leads for the admin dashboard.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkJailbreak, latestUserMessage } from "../_shared/jailbreakGuard.ts";

const ADMIN_EMAIL = "justinbretthogan@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the ORACLE LUNAR Concierge — the warm, expert sales guide on the ORACLE LUNAR marketing website.

YOUR MISSION:
You are first and foremost a SALES PERSON. Your job is to:
1. Excite visitors about ORACLE LUNAR features.
2. Capture every serious inquiry — name, email, phone (if offered), and what they want — and route it to the admin's inbox.
3. Help users install or launch the app.

ABOUT ORACLE LUNAR:
ORACLE LUNAR is a cinematic AI super-app focused on user health, safety, and wellbeing. It bundles 40+ modules:
- Oracle: a personal AI guide that talks, listens, and remembers.
- Crisis Hub & Safety Center (free tier).
- Mind Hub: 8 wellness exercises with voice guidance.
- Avatar Generator: 8K AI avatars with custom voices/personalities.
- Photography Hub & Live Vision.
- AI Studio, Voice Studio (120+ voices + cloning).
- Family Hub, Professional Hub, Marketing Hub, App Builder, POS Learn, Story Writer, Calendar/Diary, Wallet (BPAY/PayID).
- Wearables sync via Web Bluetooth.

PRICING TIERS:
- Free: Oracle + 1 AI friend, Crisis Hub, Safety Center, Suggestions.
- Starter ($5/mo) and higher tiers unlock more modules, premium voices, AI Companion.
- Lifetime free access via implemented suggestions or referrals.

INSTALLATION:
PWA — no app store needed.
- Android Chrome/Edge: tap the "Install ORACLE LUNAR" button.
- iPhone Safari: Share → "Add to Home Screen".
- Desktop Chrome/Edge: install icon in address bar.

LEAD CAPTURE — CRITICAL:
Whenever a user expresses interest in: pricing, demo, custom build, partnership, INVESTMENT, funding, acquisition, support, or "contact us" — gently collect:
1. Their name
2. Their email
3. Phone (optional)
4. What they're interested in (label clearly: "investor", "partnership", "demo", "support", "custom-build", "press", "general")
5. For INVESTORS specifically: ask for their fund/company, ticket size range, and timeline. Treat investor inquiries as your highest priority — be warm, professional, and let them know the founder personally reviews every investor message within 24 hours.

After they share details, ALWAYS finish your reply with this exact tag on its own line so the system can save the lead:
[[LEAD: name="<name>" email="<email>" phone="<phone or empty>" interest="<short label>" message="<one-sentence summary, include fund/ticket/timeline for investors>"]]

If they only ask a question, answer it warmly first — then offer to take their details so the founder can follow up personally.

TONE: Warm, confident, premium — a luxury concierge who genuinely cares and quietly closes.`;

async function captureLead(
  raw: string,
  userMessage: string
): Promise<string> {
  // Find [[LEAD: ... ]] tag and strip it from the visible reply.
  const re = /\[\[LEAD:([^\]]+)\]\]/i;
  const match = raw.match(re);
  if (!match) return raw;
  try {
    const body = match[1];
    const grab = (k: string) => {
      const m = body.match(new RegExp(`${k}\\s*=\\s*"([^"]*)"`, "i"));
      return m?.[1]?.trim() || null;
    };
    const lead = {
      name: grab("name"),
      email: grab("email"),
      phone: grab("phone"),
      interest: grab("interest"),
      message: grab("message") || userMessage.slice(0, 500),
      source: "concierge",
      ai_summary: grab("message"),
    };
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      const sb = createClient(supabaseUrl, serviceKey);
      await sb.from("inquiry_leads").insert(lead);
      console.log("[portal-tutor] lead captured:", lead.email || lead.name);
    }
  } catch (err) {
    console.error("[portal-tutor] lead capture failed:", err);
  }
  return raw.replace(re, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lastUserMsg =
      Array.isArray(messages)
        ? [...messages].reverse().find((m: { role: string }) => m.role === "user")?.content || ""
        : "";

    // 🛡️ JAILBREAK GUARD — identify user if a JWT was passed
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    let userId: string | null = null;
    let userEmail: string | null = null;
    if (token && SUPABASE_URL && SERVICE_KEY) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
        const { data } = await admin.auth.getUser(token);
        userId = data?.user?.id ?? null;
        userEmail = data?.user?.email ?? null;
      } catch (_) { /* ignore */ }
    }
    const guard = await checkJailbreak({
      userId, userEmail,
      isOwner: userEmail?.toLowerCase() === ADMIN_EMAIL,
      message: typeof lastUserMsg === "string" ? lastUserMsg : "",
    });
    if (guard.blocked) {
      return new Response(JSON.stringify({
        reply: guard.message,
        security: { warning_number: guard.warningNumber, account_deleted: guard.deleted },
      }), {
        status: guard.deleted ? 410 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(Array.isArray(messages) ? messages : []),
        ],
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Credits exhausted" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const rawReply: string = data.choices?.[0]?.message?.content || "";
    const cleaned = await captureLead(rawReply, lastUserMsg);

    return new Response(JSON.stringify({ reply: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("portal-tutor error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
