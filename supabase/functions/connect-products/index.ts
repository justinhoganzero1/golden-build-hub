// Legacy Stripe Connect product listing — retired. Creator products are
// listed and sold through the Creator Shop under Lovable-managed payments.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      products: [],
      moved: true,
      message: "Creator storefronts have moved to the Creator Shop.",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
