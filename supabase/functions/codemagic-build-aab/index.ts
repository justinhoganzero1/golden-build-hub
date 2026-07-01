// Admin-only: triggers a Codemagic build of the Android AAB via Codemagic REST API.
// Docs: https://docs.codemagic.io/rest-api/builds/
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OWNER_EMAIL = "justinbretthogan@gmail.com";
const WORKFLOW_ID = "android-aab-release";
const DEFAULT_BRANCH = "main";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const CODEMAGIC_API_TOKEN = Deno.env.get("CODEMAGIC_API_TOKEN");
    const CODEMAGIC_APP_ID = Deno.env.get("CODEMAGIC_APP_ID");

    // Admin gate
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: caller } = await userClient.auth.getUser();
    const callerEmail = (caller?.user?.email || "").trim().toLowerCase();
    if (callerEmail !== OWNER_EMAIL) {
      return new Response(JSON.stringify({ error: "Owner access required" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Config check
    const missing: string[] = [];
    if (!CODEMAGIC_API_TOKEN) missing.push("CODEMAGIC_API_TOKEN");
    if (!CODEMAGIC_APP_ID) missing.push("CODEMAGIC_APP_ID");
    if (missing.length) {
      return new Response(
        JSON.stringify({
          error: "Codemagic not configured",
          missing,
          hint: "Add these secrets in Lovable, then retry.",
        }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    let branch = DEFAULT_BRANCH;
    try {
      const body = await req.json();
      if (body?.branch && typeof body.branch === "string") branch = body.branch;
    } catch (_e) { /* no body */ }

    const res = await fetch("https://api.codemagic.io/builds", {
      method: "POST",
      headers: {
        "x-auth-token": CODEMAGIC_API_TOKEN!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appId: CODEMAGIC_APP_ID,
        workflowId: WORKFLOW_ID,
        branch,
      }),
    });

    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Codemagic API error", status: res.status, details: json }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const buildId = json?.buildId || json?._id || null;
    return new Response(
      JSON.stringify({
        ok: true,
        buildId,
        branch,
        workflowId: WORKFLOW_ID,
        message: "Codemagic build started. You'll get an email when the AAB is ready (~8 min).",
        dashboard: buildId ? `https://codemagic.io/app/${CODEMAGIC_APP_ID}/build/${buildId}` : null,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("codemagic-build-aab error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
