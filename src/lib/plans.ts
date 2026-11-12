// One source of truth for Oracle Lunar plans: prices, monthly AI credit, and
// which pages each plan opens. The server enforces the same split for paid AI
// (service_required_plan in the database); this file drives the app's screens.

export type PlanId = "free" | "plus" | "pro" | "founder" | "owner";
export type PaidPlan = "plus" | "pro";
export type BillingInterval = "month" | "year";
export type PlanPriceId = "plus_monthly" | "plus_yearly" | "pro_monthly" | "pro_yearly";

export interface PlanInfo {
  id: PaidPlan;
  name: string;
  monthlyAud: number;
  yearlyAud: number;
  /** Wallet credit added each paid month, in wallet (US) cents. */
  monthlyCreditCents: number;
  /** Rough Australian-dollar value shown to members. */
  monthlyCreditAudLabel: string;
  tagline: string;
  features: string[];
}

export const PLANS: Record<PaidPlan, PlanInfo> = {
  plus: {
    id: "plus",
    name: "Plus",
    monthlyAud: 9.99,
    yearlyAud: 99.9,
    monthlyCreditCents: 200,
    monthlyCreditAudLabel: "about A$3",
    tagline: "Oracle's full chat and creative tools",
    features: [
      "Full Oracle chat with her premium voice",
      "Outfits and look builder",
      "Story Writer and author tools",
      "Photo, image, music and sound tools",
      "Mind Hub, AI Tutor and agent chats",
      "Oracle Videos library",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyAud: 24.99,
    yearlyAud: 249.9,
    monthlyCreditCents: 650,
    monthlyCreditAudLabel: "about A$10",
    tagline: "Everything, including video and build tools",
    features: [
      "Everything in Plus",
      "Movie Studio, Video Editor and YouTube Studio",
      "AI video and animated GIFs",
      "App Builder and Oracle coder",
      "Live Vision, phone calls and Voice Receptionist",
      "Voice cloning and upscaling",
    ],
  },
};

export const FREE_FEATURES = [
  "Oracle's welcome and guided tour",
  "Calendar, diary and reminders",
  "Your Library and Book Reader",
  "Crisis Hub and safety pages",
  "Creator Shop browsing and buying",
];

export const priceIdFor = (plan: PaidPlan, interval: BillingInterval): PlanPriceId =>
  `${plan}_${interval === "year" ? "yearly" : "monthly"}` as PlanPriceId;

export const yearlySavingAud = (plan: PaidPlan) =>
  Math.round((PLANS[plan].monthlyAud * 12 - PLANS[plan].yearlyAud) * 100) / 100;

export const planRank = (plan: PlanId | null | undefined): number =>
  plan === "owner" ? 3 : plan === "pro" ? 2 : plan === "plus" || plan === "founder" ? 1 : 0;

export const planAllows = (plan: PlanId | null | undefined, needed: PlanId) => planRank(plan) >= planRank(needed);

export const planLabel = (plan: PlanId) =>
  plan === "owner" ? "Owner" : plan === "founder" ? "Founder" : plan === "free" ? "Free" : PLANS[plan].name;

export interface MembershipRow {
  plan?: string | null;
  plan_active_until?: string | null;
  founder_number?: number | null;
  monthly_active_until?: string | null;
}

/** Mirrors member_plan() in the database. */
export function resolvePlan(m: MembershipRow | null | undefined, owner: boolean, now = Date.now()): PlanId {
  if (owner) return "owner";
  if (!m) return "free";
  const live = (iso?: string | null) => !!iso && new Date(iso).getTime() > now;
  if (m.plan === "pro" && live(m.plan_active_until)) return "pro";
  if (live(m.monthly_active_until)) return "pro"; // legacy single monthly plan
  if (m.plan === "plus" && live(m.plan_active_until)) return "plus";
  if (m.founder_number) return "founder";
  return "free";
}

// ---- Pages ----

/** Open to every signed-in account, including Free. Only things that cost nothing to run. */
const FREE_PAGES = [
  "/", "/index", "/dashboard", "/welcome", "/get-started", "/oracle", "/chat-oracle", "/oracle-preview",
  "/free-zone", "/founder-vault", "/founder-seats", "/calendar", "/alarm-clock", "/special-occasions",
  "/media-library", "/my-library", "/library", "/public-library", "/read", "/book", "/stories",
  "/crisis-hub", "/safety-center", "/membership", "/subscribe", "/subscription", "/subscription-timeline",
  "/wallet", "/credit", "/profile", "/settings", "/my-account", "/terms-of-service", "/privacy-policy",
  "/module-shop", "/creators", "/store", "/referral", "/suggestion-box", "/inbox", "/personal-vault", "/vault",
  "/my-apps", "/purchase-success", "/unlock-success", "/movie-payment-success", "/diagnostics",
  "/consent", "/age-required", "/verify-phone", "/owner-dashboard", "/admin",
  // The fictional insurance demo has its own separate access rules.
  "/reimagined-insurance", "/workcover-reimagined", "/claims-app", "/claims-assistant",
];

/** Heavy video, build, telephony and vision tools. */
const PRO_PAGES = [
  "/movie-studio-pro", "/immersive-movie-studio", "/video-editor", "/youtube-show-studio", "/living-gif-studio",
  "/app-builder", "/ai-3d-app-builder", "/live-vision", "/voice-receptionist", "/web-wrapper",
];

const matches = (list: string[], path: string) =>
  list.some((p) => path === p || (p !== "/" && path.startsWith(`${p}/`)));

/** The plan a page needs. Pages not listed as Free or Pro need Plus. */
export function pagePlan(rawPath: string): "free" | PaidPlan {
  const path = rawPath.split(/[?#]/)[0] || "/";
  if (matches(PRO_PAGES, path)) return "pro";
  if (matches(FREE_PAGES, path)) return "free";
  return "plus";
}
