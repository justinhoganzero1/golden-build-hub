import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  fingerprint: number[];
  peakHz?: number;
  loudnessDb?: number;
  isTransient?: boolean;
}

function classifyHeuristic(peakHz: number, isTransient: boolean): { label: string; category: string; action: string } {
  // Cheap first-pass classifier. AI labelling can be added later via Lovable AI.
  if (peakHz < 200) return { label: "Low rumble", category: "ambient", action: "suppress" };
  if (peakHz < 500) return { label: isTransient ? "Thud" : "Engine hum", category: "ambient", action: "suppress" };
  if (peakHz < 1500) return { label: isTransient ? "Knock" : "Background voice", category: "media", action: "suppress" };
  if (peakHz < 3000) return { label: isTransient ? "Clatter" : "Mid-tone alarm", category: "alarm", action: "alert" };
  if (peakHz < 6000) return { label: isTransient ? "Clink" : "High whistle", category: "household", action: "suppress" };
  return { label: "Hiss", category: "ambient", action: "suppress" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = (await req.json()) as Body;
    if (!Array.isArray(body.fingerprint) || body.fingerprint.length < 8) {
      return new Response(JSON.stringify({ error: "invalid fingerprint" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const peakHz = Number(body.peakHz) || 0;
    const isTransient = !!body.isTransient;
    const { label, category, action } = classifyHeuristic(peakHz, isTransient);

    // Look for existing similar label from this user — increment occurrences instead of duplicating
    const { data: existing } = await supabase
      .from("sound_signatures")
      .select("id, occurrences, fingerprint")
      .eq("user_id", user.id)
      .eq("label", label)
      .limit(1)
      .maybeSingle();

    let saved: any = null;

    if (existing) {
      // Blend fingerprint
      const blended = (existing.fingerprint as number[] || []).map((v: number, i: number) =>
        v * 0.85 + (body.fingerprint[i] || 0) * 0.15
      );
      const { data, error } = await supabase
        .from("sound_signatures")
        .update({
          occurrences: (existing.occurrences || 1) + 1,
          last_heard_at: new Date().toISOString(),
          fingerprint: blended,
          confidence: Math.min(1, 0.5 + ((existing.occurrences || 1) + 1) * 0.05),
        })
        .eq("id", existing.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase
        .from("sound_signatures")
        .insert({
          user_id: user.id,
          label,
          category,
          fingerprint: body.fingerprint,
          peak_hz: peakHz,
          loudness_db: body.loudnessDb || null,
          is_transient: isTransient,
          is_continuous: !isTransient,
          action,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      saved = data;
    }

    return new Response(JSON.stringify({
      ok: true,
      signature: saved && {
        id: saved.id,
        label: saved.label,
        category: saved.category,
        fingerprint: saved.fingerprint,
        centroidHz: Number(saved.centroid_hz) || 0,
        bandwidthHz: Number(saved.bandwidth_hz) || 0,
        peakHz: Number(saved.peak_hz) || 0,
        durationMs: saved.duration_ms || 0,
        loudnessDb: Number(saved.loudness_db) || 0,
        isTransient: !!saved.is_transient,
        isContinuous: !!saved.is_continuous,
        action: saved.action,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("noise-learn error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
