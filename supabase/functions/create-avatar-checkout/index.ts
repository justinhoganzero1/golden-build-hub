import { statusFor } from "../_shared/errorStatus.ts";
import { safeOrigin } from "../_shared/origin.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { type StripeEnv, createEmbeddedSession } from "../_shared/stripe.ts";

// AI Friend Avatar ($3 one-time) and AI Partner ($15/mo) checkout via
// Lovable built-in payments (embedded checkout). Delivery is recorded
// server-side by the payments webhook into app_unlocks.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { product, environment } = await req.json();
    if (environment !== "sandbox" && environment !== "live") throw new Error("invalid environment");
    const env: StripeEnv = environment;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const isPartner = product === "partner";
    if (!isPartner && product !== "avatar") throw new Error("invalid product");

    const origin = safeOrigin(req);
    const { clientSecret, sessionId } = await createEmbeddedSession({
      env,
      userId: user.id,
      email: user.email,
      priceLookupKey: isPartner ? "ai_partner_monthly" : "ai_friend_avatar_once",
      returnUrl: `${origin}/avatar-generator?purchased=${product}&session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        purchase_type: "avatar_purchase",
        avatar_product: product,
        user_id: user.id,
      },
    });

    return new Response(JSON.stringify({ clientSecret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusFor(error),
    });
  }
});
