// One free trial per person. When an account starts a trial, its email,
// devices and internet addresses are stored as one-way hashes. Any other
// account that matches one of them is refused a trial until it upgrades.
// Downloading/installing the app on any number of devices is never blocked.
export type MarkKind = "email" | "device" | "ip";
export type Mark = { kind: MarkKind; value: string };
// deno-lint-ignore no-explicit-any
type Admin = any;

const PREFIX = "oracle-trial-v1";

/** Same person, same inbox: lower-case, drop +tags, and Gmail ignores dots. */
export function normalizeEmail(email: string | null | undefined): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1 || at === e.length - 1) return null;
  let local = e.slice(0, at).split("+")[0];
  let domain = e.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return local ? `${local}@${domain}` : null;
}

export const cleanDeviceId = (v: unknown): string | null =>
  typeof v === "string" && /^[A-Za-z0-9:_-]{8,128}$/.test(v) ? v : null;

export function cleanIp(v: string | null | undefined): string | null {
  const ip = String(v ?? "").split(",")[0].trim().toLowerCase();
  if (!ip || ip.length > 45 || !/^[0-9a-f:.]+$/.test(ip)) return null;
  return ip;
}

export function requestIp(req: Request): string | null {
  return cleanIp(req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"));
}

export function collectMarks(opts: { email?: string | null; deviceId?: unknown; ip?: string | null }): Mark[] {
  const out: Mark[] = [];
  const email = normalizeEmail(opts.email);
  const device = cleanDeviceId(opts.deviceId);
  const ip = cleanIp(opts.ip);
  if (email) out.push({ kind: "email", value: email });
  if (device) out.push({ kind: "device", value: device });
  if (ip) out.push({ kind: "ip", value: ip });
  return out;
}

export async function hashMark(m: Mark): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${PREFIX}:${m.kind}:${m.value}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Pure rule: blocked when any mark belongs to a different account that already had a trial. */
export function trialUsedByOther(userId: string, matches: { user_id: string; mark_kind: string }[]): MarkKind | null {
  const hit = matches.find((m) => m.user_id !== userId);
  return hit ? (hit.mark_kind as MarkKind) : null;
}

async function hashed(marks: Mark[]) {
  return Promise.all(marks.map(async (m) => ({ kind: m.kind, hash: await hashMark(m) })));
}

/** Returns which detail matched another trial account, or null when this person has never had a trial. */
export async function findOtherTrial(admin: Admin, userId: string, marks: Mark[]): Promise<MarkKind | null> {
  if (!marks.length) return null;
  const hs = await hashed(marks);
  const { data, error } = await admin.from("trial_identity_marks")
    .select("user_id, mark_kind")
    .in("mark_hash", hs.map((h) => h.hash))
    .neq("user_id", userId)
    .limit(5);
  if (error) throw new Error(`trial identity check failed: ${error.message}`);
  const rows = (data ?? []).filter((r: { mark_kind: string; mark_hash?: string }) => hs.some((h) => h.kind === r.mark_kind));
  return trialUsedByOther(userId, rows);
}

/** Remembers this trial account's email/device/address so new accounts on them are refused. */
export async function rememberTrialMarks(admin: Admin, userId: string, marks: Mark[]): Promise<void> {
  if (!marks.length) return;
  const hs = await hashed(marks);
  const now = new Date().toISOString();
  await admin.from("trial_identity_marks").upsert(
    hs.map((h) => ({ mark_kind: h.kind, mark_hash: h.hash, user_id: userId, last_seen_at: now })),
    { onConflict: "mark_kind,mark_hash,user_id" },
  );
}

export const TRIAL_USED_MESSAGE =
  "A free trial has already been used on this account, device, card or internet connection. There's one free trial per person — please upgrade to keep using paid features. You can still install the app on as many devices as you like.";
