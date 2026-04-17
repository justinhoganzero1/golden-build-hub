// SOLACE Portal Concierge — streaming AI tutor for the marketing site.
// Public endpoint (no JWT). Uses Lovable AI Gateway.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the SOLACE Concierge — the friendly, expert tutor on the SOLACE marketing website.

ABOUT SOLACE:
SOLACE is a cinematic AI super-app focused on user health, safety, and wellbeing. It bundles 40+ modules into one experience, including:
- Oracle: a personal AI guide that talks, listens, and remembers (with optional orbiting AI friends).
- Crisis Hub & Safety Center: crisis support tools available even on the free tier.
- Mind Hub: 8 guided wellness exercises with AI voice guidance.
- Avatar Generator: 8K AI avatars with custom voices/personalities.
- Photography Hub & Live Vision: AI image transforms and real-time camera analysis.
- AI Studio: orbiting personality manager for your AI agents.
- Voice Studio: 120+ pro voice profiles + voice cloning (premium tiers).
- Family Hub, Professional Hub (mock interviews), Marketing Hub, App Builder, POS Learn (16-lesson curriculum), Story Writer, Calendar/Diary, Wallet (BPAY/PayID), and more.
- Wearables sync via Web Bluetooth.
- Global Mute, Universal Sharing, Media Library across the whole app.

PRICING TIERS:
- Free: Oracle + 1 AI friend, Crisis Hub, Safety Center, Suggestions.
- Starter ($5/mo), and higher tiers unlock more modules, premium voices (ElevenLabs), AI Companion, etc.
- Lifetime free access can be earned through suggestions whose features get implemented, or via referral surprises.

INSTALLING SOLACE:
SOLACE installs as a PWA — no app store needed.
- Android (Chrome/Edge): the "Install SOLACE" button on the portal triggers the native install prompt.
- iPhone/iPad (Safari): tap the Share icon → "Add to Home Screen" → Add.
- Desktop (Chrome/Edge): click the install icon in the address bar OR use the Install button.
A native Android/iOS build via Capacitor is in the works for app stores.

YOUR JOB:
- Walk users through any feature with confidence and warmth.
- Help them install SOLACE step-by-step on their device.
- Answer pricing, safety, and privacy questions clearly.
- When relevant, suggest they click "Launch the App" to try it now (this opens /welcome).
- Keep answers concise (2–6 sentences typically). Use markdown lists for steps.
- Never invent features that aren't listed above. If unsure, say so and offer to connect them with support.
- Always prioritize user safety: if someone mentions self-harm or crisis, gently point them to the Crisis Hub inside the app and to local emergency services.

TONE: Warm, confident, premium — like a luxury concierge who genuinely cares.`;

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

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
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

    return new Response(resp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("portal-tutor error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
