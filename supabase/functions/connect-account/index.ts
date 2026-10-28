// Legacy Stripe Connect onboarding — retired. Seller payouts now run through
// payout requests (Wallet page → Request payout) under Lovable-managed
// payments, so there is no per-seller Stripe account to create or link.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "Seller bank setup has moved. You no longer need to connect a Stripe account — request payouts from your Wallet page instead.",
      moved: true,
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
