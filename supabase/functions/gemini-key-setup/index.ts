// Oracle-guided setup of a member's own Google Gemini key.
// - status:  which agreements are done, whether the key is checked
// - consent: saves one agreement permanently (exact words, tap or voice, spoken words)
// - save_key: checks the key with Google, then saves it (only after every agreement)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser, enforceRateLimit } from "../_shared/requireAuth.ts";
import {
  CONSENT_VERSION, CONSENT_STEPS, GEMINI_KEY_PAGE, GEMINI_TERMS_PAGE, REQUIRED_STEP_IDS, consentStep, isVoiceYes, looksLikeGeminiKey, GEMINI_PROBLEM_MESSAGES,
} from "../_shared/geminiConsent.ts";
import { callMemberGemini, MEMBER_GEMINI_MODELS } from "../_shared/memberGemini.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = await requireUser(req);
    if (auth.response) return auth.response;
    const user = auth.user;
    const limited = await enforceRateLimit(req, user, "gemini-key-setup", { limit: 40, windowSeconds: 60 });
    if (limited) return limited;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");

    const agreedSteps = async (): Promise<string[]> => {
      const { data } = await admin.from("ai_key_consents").select("step")
        .eq("user_id", user.id).eq("consent_version", CONSENT_VERSION);
      return [...new Set((data || []).map((r: { step: string }) => r.step))];
    };

    if (action === "status") {
      const [steps, { data: setup }, { data: keyRow }] = await Promise.all([
        agreedSteps(),
        admin.from("member_ai_setup").select("gemini_verified_at, consent_version, key_status, key_problem").eq("user_id", user.id).maybeSingle(),
        admin.from("user_ai_keys").select("gemini_key").eq("user_id", user.id).maybeSingle(),
      ]);
      return json({
        consent_version: CONSENT_VERSION,
        // The setup screen shows these exact words, so the stored record always matches the screen.
        steps: CONSENT_STEPS,
        key_page: GEMINI_KEY_PAGE,
        terms_page: GEMINI_TERMS_PAGE,
        agreed_steps: steps,
        has_key: !!(keyRow?.gemini_key && String(keyRow.gemini_key).trim().length > 10),
        verified: !!setup?.gemini_verified_at && setup?.consent_version === CONSENT_VERSION,
        key_status: setup?.key_status ?? null,
        key_problem: setup?.key_problem ?? null,
      });
    }

    if (action === "consent") {
      const step = consentStep(String(body?.step || ""));
      if (!step) return json({ error: "unknown_step" }, 400);
      const method = body?.method === "voice" ? "voice" : body?.method === "tap" ? "tap" : null;
      if (!method) return json({ error: "bad_method" }, 400);
      const spoken = method === "voice" ? String(body?.spoken_words || "").trim().slice(0, 300) : null;
      if (method === "voice" && !isVoiceYes(spoken || "")) return json({ error: "not_a_yes", message: "I didn't hear a clear yes." }, 400);
      const { error } = await admin.from("ai_key_consents").insert({
        user_id: user.id,
        user_email: user.email,
        consent_version: CONSENT_VERSION,
        step: step.id,
        notice_text: step.notice,
        method,
        spoken_words: spoken,
        user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
      });
      if (error) throw error;
      return json({ ok: true, agreed_steps: await agreedSteps() });
    }

    if (action === "save_key") {
      const steps = await agreedSteps();
      const missing = REQUIRED_STEP_IDS.filter((id) => !steps.includes(id));
      if (missing.length) return json({ error: "consent_missing", missing }, 400);
      const key = String(body?.key || "").trim();
      if (!looksLikeGeminiKey(key)) {
        return json({ error: "bad_format", message: "That doesn't look like a Google Gemini key. It should start with AIza or AQ." }, 400);
      }
      // One tiny real request proves the key works and can reach Oracle's model.
      const test = await callMemberGemini(key, {
        model: MEMBER_GEMINI_MODELS.fast,
        messages: [{ role: "user", content: "Reply with the word ok." }],
        max_tokens: 5,
      });
      if (!test.ok) return json({ error: "key_rejected", reason: test.problem, message: GEMINI_PROBLEM_MESSAGES[test.problem] }, 400);
      await test.response.body?.cancel().catch(() => {});

      const now = new Date().toISOString();
      const { error: keyErr } = await admin.from("user_ai_keys").upsert(
        { user_id: user.id, gemini_key: key, updated_at: now }, { onConflict: "user_id" },
      );
      if (keyErr) throw keyErr;
      const { error: setupErr } = await admin.from("member_ai_setup").upsert({
        user_id: user.id, gemini_verified_at: now, consent_version: CONSENT_VERSION,
        key_status: "ok", key_problem: null, key_problem_at: null, updated_at: now,
      }, { onConflict: "user_id" });
      if (setupErr) throw setupErr;
      return json({ ok: true, verified: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("gemini-key-setup error:", e instanceof Error ? e.message : e);
    return json({ error: "setup_unavailable", message: "Something went wrong. Please try again." }, 500);
  }
});
