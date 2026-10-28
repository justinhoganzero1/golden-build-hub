import { statusFor } from "../_shared/errorStatus.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { safeOrigin } from "../_shared/origin.ts";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    // Optional safe return path (only same-app absolute paths allowed).
    // Parse the body BEFORE creating the Stripe client: `environment` must be
    // resolved before it is referenced, otherwise every request throws and
    // the billing portal can never open.
    let returnTo = "/subscribe";
    let environment: StripeEnv = "sandbox";
    let envSeen = false;
    try {
      const body = await req.json();
      if (body?.returnTo && typeof body.returnTo === "string" && body.returnTo.startsWith("/") && !body.returnTo.startsWith("//")) {
        returnTo = body.returnTo;
      }
      if (body?.environment === "sandbox" || body?.environment === "live") {
        environment = body.environment;
        envSeen = true;
      }
    } catch {
      /* no body — keep default */
    }
    if (!envSeen) throw new Error("invalid environment");

    const stripe = createStripeClient(environment);
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) throw new Error("No Stripe customer found for this user");

    const customerId = customers.data[0].id;
    const origin = safeOrigin(req);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}${returnTo}`,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusFor(error),
    });
  }
});
