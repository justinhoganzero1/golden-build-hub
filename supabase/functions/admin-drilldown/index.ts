// admin-drilldown — owner-only "show me the details" behind every figure on
// the Owner Dashboard. Each metric is whitelisted; filters are validated and
// passed through query builders only. Returns { title, note, columns, rows }.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { enforceRateLimit, requireOwner } from "../_shared/requireAuth.ts";
import { createStripeClient } from "../_shared/stripe.ts";
import {
  deviceFromUserAgent,
  isRealMoneyEnvironment,
  planLabel,
  trafficSource,
} from "../_shared/ownerMetrics.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type ColType = "text" | "date" | "money";
type Col = { key: string; label: string; type?: ColType };
type Row = Record<string, unknown>;

const SAFE = /^[A-Za-z0-9._\-@:/+()# ]{0,160}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && SAFE.test(t) ? t : null;
};
const int = (v: unknown, min: number, max: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : d;
};
const iso = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const METRICS = new Set([
  "users_all", "paid_members", "trial_users", "page_views", "install_events",
  "real_payments", "live_subscriptions", "payouts", "balance",
  "ai_charges", "stripe_events", "affiliate_clicks", "site_arrivals",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireOwner(req);
  if (auth.response) return auth.response;
  const rl = await enforceRateLimit(req, auth.user, "admin-drilldown", { limit: 60, windowSeconds: 60 });
  if (rl) return rl;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const metric = String(body.metric ?? "");
  if (!METRICS.has(metric)) return json({ error: "unknown_metric" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Lazy user directory: id -> email/name/joined/last sign-in.
  let directory: Map<string, { email: string; name: string; created_at: string | null; last_sign_in_at: string | null }> | null = null;
  const users = async () => {
    if (directory) return directory;
    directory = new Map();
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const u of data.users) {
        directory.set(u.id, {
          email: u.email ?? "",
          name: String((u.user_metadata as any)?.display_name ?? (u.user_metadata as any)?.full_name ?? ""),
          created_at: u.created_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
      if (data.users.length < 1000) break;
    }
    const { data: profiles } = await admin.from("profiles").select("user_id, display_name");
    for (const p of (profiles ?? []) as any[]) {
      const d = directory.get(p.user_id);
      if (d && p.display_name) d.name = p.display_name;
    }
    return directory;
  };
  const who = async (id: string | null | undefined) => {
    if (!id) return "—";
    const d = (await users()).get(id);
    return d ? (d.email || d.name || id.slice(0, 8)) : id.slice(0, 8);
  };
  const ownerIdsP = (async () => {
    const { data } = await admin.from("user_roles").select("user_id").in("role", ["admin", "owner"]);
    return new Set((data ?? []).map((r: any) => String(r.user_id)));
  })();

  const out = (title: string, columns: Col[], rows: Row[], note?: string) =>
    json({ title, columns, rows: rows.slice(0, 5000), total: rows.length, note: note ?? null });

  try {
    switch (metric) {
      case "users_all": {
        const dir = await users();
        const [{ data: mem }, { data: wallets }, { data: grants }] = await Promise.all([
          admin.from("memberships").select("user_id, plan, plan_status, founder_number"),
          admin.from("wallet_balances").select("user_id, balance_cents"),
          admin.from("reward_grants").select("user_id, reward_type").eq("active", true).gt("expires_at", new Date().toISOString()),
        ]);
        const memBy = new Map((mem ?? []).map((m: any) => [m.user_id, m]));
        const walBy = new Map((wallets ?? []).map((w: any) => [w.user_id, w.balance_cents]));
        const grantBy = new Map((grants ?? []).map((g: any) => [g.user_id, g.reward_type]));
        const owners = await ownerIdsP;
        const rows = [...dir.entries()].map(([id, u]) => {
          const m: any = memBy.get(id);
          const plan = owners.has(id) ? "Owner" : m?.founder_number != null ? `Founder #${m.founder_number}`
            : m?.plan && m.plan !== "free" && m.plan_status === "active" ? `${m.plan} (${m.plan_status})` : "Free";
          return {
            name: u.name || "—", email: u.email || "—", plan,
            freebie: grantBy.get(id) ?? "—",
            wallet: walBy.get(id) ?? 0,
            joined: u.created_at, last_seen: u.last_sign_in_at,
          };
        }).sort((a, b) => String(b.joined).localeCompare(String(a.joined)));
        return out("All users", [
          { key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "plan", label: "Plan" },
          { key: "freebie", label: "Free access" }, { key: "wallet", label: "Wallet", type: "money" },
          { key: "joined", label: "Joined", type: "date" }, { key: "last_seen", label: "Last signed in", type: "date" },
        ], rows);
      }

      case "paid_members": {
        const [{ data: subs }, { data: founders }] = await Promise.all([
          admin.from("subscriptions").select("user_id, price_id, status, environment, current_period_end, cancel_at_period_end, created_at").order("created_at", { ascending: false }),
          admin.from("memberships").select("user_id, founder_number, created_at").not("founder_number", "is", null),
        ]);
        const dir = await users();
        const rows: Row[] = [];
        for (const s of (subs ?? []) as any[]) {
          const u = dir.get(s.user_id);
          const real = isRealMoneyEnvironment(s.environment);
          const active = ["active", "trialing"].includes(s.status);
          rows.push({
            name: u?.name || "—", email: u?.email || s.user_id,
            plan: planLabel(s.price_id), status: s.cancel_at_period_end ? `${s.status} (cancelling)` : s.status,
            money: real ? "Real money" : "Test money — not counted",
            counted: real && active ? "Yes" : "No",
            started: s.created_at, renews: s.current_period_end,
          });
        }
        for (const f of (founders ?? []) as any[]) {
          const u = dir.get(f.user_id);
          rows.push({
            name: u?.name || "—", email: u?.email || f.user_id, plan: `Founder seat #${f.founder_number}`,
            status: "lifetime", money: "Real money", counted: "Yes", started: f.created_at, renews: null,
          });
        }
        return out("Paid members", [
          { key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "plan", label: "Plan" },
          { key: "status", label: "Status" }, { key: "money", label: "Money" }, { key: "counted", label: "Counted" },
          { key: "started", label: "Started", type: "date" }, { key: "renews", label: "Renews", type: "date" },
        ], rows, "Only real-money members are counted in the dashboard figure. Test payments are listed so you can see them.");
      }

      case "trial_users": {
        const { data } = await admin.from("reward_grants")
          .select("user_id, reward_type, reason, starts_at, expires_at")
          .eq("active", true).gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: true }).limit(1000);
        const dir = await users();
        const rows = ((data ?? []) as any[]).map((g) => ({
          name: dir.get(g.user_id)?.name || "—", email: dir.get(g.user_id)?.email || g.user_id,
          type: g.reward_type ?? "—", reason: g.reason ?? "—", started: g.starts_at, expires: g.expires_at,
        }));
        return out("Trial / free-access users", [
          { key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "type", label: "Type" },
          { key: "reason", label: "Reason" }, { key: "started", label: "Started", type: "date" },
          { key: "expires", label: "Ends", type: "date" },
        ], rows);
      }

      case "page_views": {
        const page = str(body.page);
        const medium = str(body.medium);
        const source = str(body.source)?.toLowerCase() ?? null;
        // Read in 1,000-row pages (the database caps each read) up to the latest 5,000.
        const data: any[] = [];
        for (let from = 0; from < 5000; from += 1000) {
          let q = admin.from("page_views").select("page, referrer, utm_source, utm_medium, utm_campaign, user_agent, created_at")
            .order("created_at", { ascending: false }).range(from, from + 999);
          if (page === "(unknown)") q = q.or("page.is.null,page.eq.");
          else if (page) q = q.eq("page", page);
          if (medium) q = q.eq("utm_medium", medium);
          const { data: chunk, error } = await q;
          if (error) throw error;
          data.push(...(chunk ?? []));
          if (!chunk || chunk.length < 1000) break;
        }
        let rows = data.map((v) => ({
          when: v.created_at, page: v.page || "(unknown)", source: trafficSource(v.utm_source, v.referrer),
          campaign: v.utm_campaign || "—", medium: v.utm_medium || "—",
          referrer: v.referrer || "—", device: deviceFromUserAgent(v.user_agent),
        }));
        if (source) rows = rows.filter((r) => r.source === source);
        const title = source ? `Visits from ${source}` : page ? `Visits to ${page}` : "Visits";
        return out(title, [
          { key: "when", label: "When", type: "date" }, { key: "page", label: "Page" }, { key: "source", label: "Came from" },
          { key: "campaign", label: "Campaign" }, { key: "medium", label: "Medium" }, { key: "device", label: "Device" },
          { key: "referrer", label: "Referring link" },
        ], rows, "Visits are anonymous — no names are recorded for website visitors. Latest 5,000 checked.");
      }

      case "site_arrivals": {
        const landing = str(body.landing_path);
        const source = str(body.source)?.toLowerCase() ?? null;
        let q = admin.from("site_arrivals").select("landing_path, source, medium, campaign, referrer, user_agent, created_at")
          .order("created_at", { ascending: false }).limit(5000);
        if (landing) q = q.eq("landing_path", landing);
        if (source) q = q.eq("source", source);
        const { data, error } = await q;
        if (error) throw error;
        const rows = ((data ?? []) as any[]).map((v) => ({
          when: v.created_at, landed: v.landing_path, source: v.source || "direct",
          campaign: v.campaign || "—", medium: v.medium || "—",
          device: deviceFromUserAgent(v.user_agent), referrer: v.referrer || "—",
        }));
        const title = landing ? `Visitors who landed on ${landing}` : source ? `Where visitors from ${source} landed` : "Where each visitor landed";
        return out(title, [
          { key: "when", label: "When", type: "date" }, { key: "landed", label: "Landed on" }, { key: "source", label: "Came from" },
          { key: "campaign", label: "Post / campaign" }, { key: "medium", label: "Medium" }, { key: "device", label: "Device" },
          { key: "referrer", label: "Referring link" },
        ], rows, "One row per visit to oraclelunar.com: the first page they opened. Anonymous — no names are recorded. Your own owner pages are not counted.");
      }

      case "install_events": {
        const kind = str(body.event_type);
        const platform = str(body.platform);
        let q = admin.from("install_events").select("event_type, platform, user_id, user_agent, created_at")
          .order("created_at", { ascending: false }).limit(5000);
        if (kind === "installed") q = q.eq("event_type", "installed");
        else if (kind === "clicks") q = q.neq("event_type", "installed");
        if (platform) q = q.eq("platform", platform);
        const { data, error } = await q;
        if (error) throw error;
        const rows: Row[] = [];
        for (const e of (data ?? []) as any[]) {
          rows.push({
            when: e.created_at, event: e.event_type, platform: e.platform || "—",
            member: e.user_id ? await who(e.user_id) : "Not signed in", device: deviceFromUserAgent(e.user_agent),
          });
        }
        const title = `${platform ? platform[0].toUpperCase() + platform.slice(1) + " " : ""}${kind === "installed" ? "installs" : kind === "clicks" ? "install clicks" : "install activity"}`;
        return out(title.charAt(0).toUpperCase() + title.slice(1), [
          { key: "when", label: "When", type: "date" }, { key: "event", label: "What happened" },
          { key: "platform", label: "Platform" }, { key: "member", label: "Member" }, { key: "device", label: "Device" },
        ], rows);
      }

      case "real_payments": {
        const days = int(body.days, 1, 365, 30);
        const owners = await ownerIdsP;
        const ownerEmails = new Set<string>();
        for (const id of owners) { const e = (await users()).get(id)?.email; if (e) ownerEmails.add(e.toLowerCase()); }
        const stripe = createStripeClient("live");
        const since = Math.floor(Date.now() / 1000) - days * 86400;
        const charges = await stripe.charges.list({ created: { gte: since }, limit: 100, expand: ["data.customer"] } as any);
        const rows = (charges.data as any[]).filter((c) => c.livemode).map((c) => {
          const email = c.billing_details?.email ?? c.receipt_email ?? c.customer?.email ?? null;
          const ids = [c.metadata?.user_id, c.metadata?.userId, c.customer?.metadata?.userId, c.customer?.metadata?.user_id].filter(Boolean).map(String);
          const own = ids.some((i) => owners.has(i)) || (email && ownerEmails.has(String(email).toLowerCase()));
          return {
            when: new Date(c.created * 1000).toISOString(), customer: email || c.billing_details?.name || "—",
            description: c.description ?? "—", amount: c.amount, currency: c.currency,
            status: c.refunded ? "refunded" : c.status,
            counted: own ? "No — your own payment" : c.paid && c.status === "succeeded" ? "Yes" : "No",
          };
        });
        return out(`Real payments — last ${days} days`, [
          { key: "when", label: "When", type: "date" }, { key: "customer", label: "Customer" },
          { key: "description", label: "For" }, { key: "amount", label: "Amount", type: "money" },
          { key: "status", label: "Status" }, { key: "counted", label: "Counted" },
        ], rows, "Live Stripe payments only. Test money and AI wallet use are never shown here.");
      }

      case "live_subscriptions": {
        const owners = await ownerIdsP;
        const stripe = createStripeClient("live");
        const subs = await stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] } as any);
        const rows = (subs.data as any[]).filter((s) => s.livemode).map((s) => {
          const item = s.items?.data?.[0];
          const own = [s.metadata?.userId, s.metadata?.user_id, s.customer?.metadata?.userId].filter(Boolean).some((i: string) => owners.has(String(i)));
          return {
            customer: s.customer?.email ?? s.customer?.name ?? "—",
            plan: planLabel(item?.price?.lookup_key ?? item?.price?.nickname ?? item?.price?.id),
            amount: item?.price?.unit_amount ?? 0, currency: item?.price?.currency ?? "aud", status: s.status,
            started: new Date(s.created * 1000).toISOString(),
            counted: own ? "No — your own" : s.status === "active" ? "Yes" : "No",
          };
        });
        return out("Live subscriptions", [
          { key: "customer", label: "Customer" }, { key: "plan", label: "Plan" },
          { key: "amount", label: "Price", type: "money" }, { key: "status", label: "Status" },
          { key: "started", label: "Started", type: "date" }, { key: "counted", label: "Counted" },
        ], rows);
      }

      case "payouts": {
        const stripe = createStripeClient("live");
        const p = await stripe.payouts.list({ limit: 100 });
        const rows = (p.data as any[]).map((x) => ({
          arrival: new Date(x.arrival_date * 1000).toISOString(), amount: x.amount, currency: x.currency,
          status: x.status, method: x.method ?? "—", description: x.description ?? "—",
        }));
        return out("Payouts to your bank", [
          { key: "arrival", label: "Arrives", type: "date" }, { key: "amount", label: "Amount", type: "money" },
          { key: "status", label: "Status" }, { key: "method", label: "Speed" }, { key: "description", label: "Note" },
        ], rows);
      }

      case "balance": {
        const stripe = createStripeClient("live");
        const b: any = await stripe.balance.retrieve();
        const rows: Row[] = [
          ...(b.available ?? []).map((x: any) => ({ kind: "Available now", amount: x.amount, currency: x.currency })),
          ...(b.pending ?? []).map((x: any) => ({ kind: "Pending (on its way)", amount: x.amount, currency: x.currency })),
        ];
        return out("Stripe balance", [
          { key: "kind", label: "Type" }, { key: "amount", label: "Amount", type: "money" }, { key: "currency", label: "Currency" },
        ], rows, "Available money can be paid out to your bank. Pending money is still clearing.");
      }

      case "ai_charges": {
        const days = int(body.days, 1, 365, 30);
        const service = str(body.service);
        const userId = typeof body.user_id === "string" && UUID.test(body.user_id) ? body.user_id : null;
        const from = iso(body.from) ?? new Date(Date.now() - days * 86400000).toISOString();
        const to = iso(body.to);
        let q = admin.from("ai_charges").select("user_id, service, total_cents, provider_cost_cents, platform_fee_cents, metadata, created_at")
          .gte("created_at", from).order("created_at", { ascending: false }).limit(2000);
        if (to) q = q.lte("created_at", to);
        if (service === "unknown") q = q.or("service.is.null,service.eq.");
        else if (service) q = q.eq("service", service);
        if (userId) q = q.eq("user_id", userId);
        const { data, error } = await q;
        if (error) throw error;
        const rows: Row[] = [];
        for (const c of (data ?? []) as any[]) {
          rows.push({
            when: c.created_at, member: await who(c.user_id), service: c.service || "unknown",
            model: c.metadata?.model ?? c.metadata?.provider ?? "—",
            charged: c.total_cents, cost: c.provider_cost_cents, margin: c.platform_fee_cents,
          });
        }
        const title = service ? `AI charges — ${service}` : userId ? `AI charges — ${await who(userId)}` : `AI charges — last ${days} days`;
        return out(title, [
          { key: "when", label: "When", type: "date" }, { key: "member", label: "Member" },
          { key: "service", label: "Service" }, { key: "model", label: "Model" },
          { key: "charged", label: "Charged", type: "money" }, { key: "cost", label: "Provider cost", type: "money" },
          { key: "margin", label: "Your margin", type: "money" },
        ], rows, "AI use paid from members' wallets. Your own use is included here because it runs through the same meter.");
      }

      case "stripe_events": {
        const hours = int(body.hours, 1, 24 * 90, 24);
        const source = str(body.source);
        const status = str(body.status);
        let q = admin.from("stripe_event_log").select("source, event_type, status, user_id, amount_cents, message, created_at")
          .gte("created_at", new Date(Date.now() - hours * 3600000).toISOString())
          .order("created_at", { ascending: false }).limit(1000);
        if (source) q = q.eq("source", source);
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) throw error;
        const rows: Row[] = [];
        for (const e of (data ?? []) as any[]) {
          rows.push({
            when: e.created_at, source: e.source, event: e.event_type, status: e.status,
            member: e.user_id ? await who(e.user_id) : "—", amount: e.amount_cents, message: e.message ?? "—",
          });
        }
        return out("Payment notices", [
          { key: "when", label: "When", type: "date" }, { key: "source", label: "Source" }, { key: "event", label: "Event" },
          { key: "status", label: "Status" }, { key: "member", label: "Member" },
          { key: "amount", label: "Amount", type: "money" }, { key: "message", label: "Message" },
        ], rows);
      }

      case "affiliate_clicks": {
        const partner = str(body.partner);
        let q = admin.from("affiliate_clicks").select("partner, placement, user_id, clicked_at, created_at")
          .order("created_at", { ascending: false }).limit(1000);
        if (partner) q = q.eq("partner", partner);
        const { data, error } = await q;
        if (error) throw error;
        const rows: Row[] = [];
        for (const c of (data ?? []) as any[]) {
          rows.push({
            when: c.clicked_at ?? c.created_at, partner: c.partner, placement: c.placement ?? "—",
            member: c.user_id ? await who(c.user_id) : "Not signed in",
          });
        }
        return out(`${partner ?? "Affiliate"} link clicks`, [
          { key: "when", label: "When", type: "date" }, { key: "partner", label: "Partner" },
          { key: "placement", label: "Where in the app" }, { key: "member", label: "Member" },
        ], rows, "Every click saved for all members. The number on the card counts only clicks on this device.");
      }
    }
    return json({ error: "unknown_metric" }, 400);
  } catch (e) {
    console.error("[admin-drilldown]", metric, e);
    return json({ error: "Could not load these details right now" }, 500);
  }
});
