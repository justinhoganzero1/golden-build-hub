// Legacy BYOK Stripe webhook — retired. All payment events are handled by
// payments-webhook under Lovable-managed payments. This stub stays so any
// old endpoint URL returns a clean response instead of an error.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }
  return new Response(JSON.stringify({ received: true, retired: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
