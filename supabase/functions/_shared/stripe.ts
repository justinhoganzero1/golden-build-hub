// Shared Stripe utility for Lovable built-in payments.
// All Stripe API calls route through the connector gateway — the env vars
// STRIPE_SANDBOX_API_KEY / STRIPE_LIVE_API_KEY are gateway connection
// identifiers, NOT real Stripe secret keys. Never instantiate a direct
// Stripe SDK client with them.
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import Stripe from "https://esm.sh/stripe@22.0.2";

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = "sandbox" | "live";

const GATEWAY_STRIPE_BASE = "https://connector-gateway.lovable.dev/stripe";

export function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox"
    ? getEnv("STRIPE_SANDBOX_API_KEY")
    : getEnv("STRIPE_LIVE_API_KEY");
}

// Routes api.stripe.com requests through the connector gateway.
// Only api.stripe.com is proxied (not files.stripe.com or connect.stripe.com).
export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv("LOVABLE_API_KEY");

  return new Stripe(connectionApiKey, {
    apiVersion: "2026-03-25.dahlia",
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      const stripeUrl = input instanceof Request ? input.url : input.toString();
      const gatewayUrl = stripeUrl.replace("https://api.stripe.com", GATEWAY_STRIPE_BASE);
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(
            new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).entries(),
          ),
          "X-Connection-Api-Key": connectionApiKey,
          "Lovable-API-Key": lovableApiKey,
        },
      });
    }),
  });
}

// Verifies Stripe webhook signatures with HMAC-SHA256 (no SDK needed).
export async function verifyWebhook(req: Request, env: StripeEnv): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret = env === "sandbox"
    ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
    : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!signature || !body) {
    throw new Error("Missing signature or body");
  }

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }

  if (!timestamp || v1Signatures.length === 0) {
    throw new Error("Invalid signature format");
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) {
    throw new Error("Webhook timestamp too old");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));

  if (!v1Signatures.includes(expected)) {
    throw new Error("Invalid webhook signature");
  }

  return JSON.parse(body);
}

// Look up an existing Customer by userId metadata (then by email), or
// create one. Putting userId on the Customer object makes later reads
// (portal, dashboards, subscriptions.search) resolvable.
export async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

// Create an embedded-checkout session and return its client secret.
// Resolves human-readable price IDs via lookup_keys when priceLookupKey is
// given; otherwise uses inline priceData (dynamic amounts like coin packs).
export async function createEmbeddedSession(options: {
  env: StripeEnv;
  userId: string;
  email?: string;
  returnUrl: string;
  metadata: Record<string, string>;
  priceLookupKey?: string;
  priceData?: { currency: string; unit_amount: number; name: string; description?: string };
  quantity?: number;
}): Promise<{ clientSecret: string; sessionId: string }> {
  const stripe = createStripeClient(options.env);
  const customerId = await resolveOrCreateCustomer(stripe, { email: options.email, userId: options.userId });

  let mode: "payment" | "subscription" = "payment";
  let lineItem: any;
  let productDescription: string | undefined;

  if (options.priceLookupKey) {
    if (!/^[a-zA-Z0-9_-]+$/.test(options.priceLookupKey)) throw new Error("Invalid priceId");
    const prices = await stripe.prices.list({ lookup_keys: [options.priceLookupKey] });
    if (!prices.data.length) throw new Error("Price not found");
    const stripePrice = prices.data[0];
    mode = stripePrice.type === "recurring" ? "subscription" : "payment";
    lineItem = { price: stripePrice.id, quantity: options.quantity || 1 };
    if (mode === "payment") {
      const productId = typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);
      productDescription = product.name;
    }
  } else if (options.priceData) {
    lineItem = {
      price_data: {
        currency: options.priceData.currency,
        unit_amount: options.priceData.unit_amount,
        product_data: { name: options.priceData.name, ...(options.priceData.description && { description: options.priceData.description }) },
      },
      quantity: options.quantity || 1,
    };
    productDescription = options.priceData.name;
  } else {
    throw new Error("priceLookupKey or priceData required");
  }

  const session = await stripe.checkout.sessions.create({
    line_items: [lineItem],
    mode,
    ui_mode: "embedded_page",
    return_url: options.returnUrl,
    customer: customerId,
    ...(mode === "payment" && productDescription && { payment_intent_data: { description: productDescription } }),
    metadata: options.metadata,
    ...(mode === "subscription" && { subscription_data: { metadata: options.metadata } }),
  } as any);

  if (!session.client_secret) throw new Error("No client secret returned");
  return { clientSecret: session.client_secret, sessionId: session.id };
}
