// Oracle outfit changes: the member's chosen outfit is saved per account on this device.
export interface OracleOutfit { url: string; label: string; libraryId?: string | null }

export const OUTFIT_PRESETS: { id: string; label: string; description: string }[] = [
  { id: "evening", label: "Evening gown", description: "an elegant floor-length black evening gown with subtle gold detail" },
  { id: "casual", label: "Casual", description: "relaxed blue jeans and a soft white t-shirt with a light denim jacket" },
  { id: "business", label: "Business suit", description: "a sharp tailored navy business suit with a cream blouse" },
  { id: "sporty", label: "Sporty", description: "smart modern activewear: a fitted zip-up track jacket and leggings" },
  { id: "cosy", label: "Cosy jumper", description: "a cosy oversized knitted cream jumper" },
  { id: "summer", label: "Summer dress", description: "a bright, floaty floral summer dress" },
];

const key = (userId: string) => `oracle-outfit:v1:${userId}`;

export function loadOutfit(userId: string | undefined): OracleOutfit | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(key(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.url === "string" && parsed.url ? parsed : null;
  } catch { return null; }
}

export function saveOutfit(userId: string, outfit: OracleOutfit | null) {
  try {
    if (!outfit) localStorage.removeItem(key(userId));
    else localStorage.setItem(key(userId), JSON.stringify(outfit));
    return true;
  } catch { return false; }
}

/** Instruction for dressing Oracle; image 1 is always her portrait. */
export function outfitPrompt(source: { photo: true } | { description: string }) {
  const outfit = "photo" in source
    ? "the outfit shown in the second image (copy its clothing style, colours, fabric and details; ignore any person, face or background in that photo)"
    : source.description;
  return `Edit the first image. Dress the woman in ${outfit}. Keep her face, identity, skin tone, hair, expression, pose, framing, lighting and the futuristic office background exactly the same; change only her clothing. Photorealistic, natural fit. Keep it tasteful and fully clothed (suitable for all ages): if the outfit is revealing, make a modest version of it.`;
}

/** Shrinks a picture to a JPEG data URL so uploads stay small. */
export async function toSmallDataUrl(src: Blob | string, max = 1024): Promise<string> {
  const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("Could not read that picture")); i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally { URL.revokeObjectURL(url); }
}

export type OutfitCommand = { kind: "photo" } | { kind: "describe"; description: string } | { kind: "reset" };

const CLOTHING = /\b(dress|gown|shirt|t-shirt|tee|blouse|jacket|blazer|suit|outfit|clothes|jumper|sweater|hoodie|cardigan|top|jeans|pants|trousers|skirt|shorts|coat|hat|cap|scarf|uniform|costume|overalls|leggings|activewear|tracksuit|kimono|saree|sari)\b/i;

/** Recognises a chat request for Oracle to change what she is wearing. */
export function parseOutfitCommand(text: string): OutfitCommand | null {
  const t = text.trim().replace(/[.!?]+$/, "");
  if (t.length > 300 || t.startsWith("[")) return null;
  const lead = String.raw`^(?:hey\s+)?(?:oracle[,\s]+)?(?:please\s+)?(?:can you\s+|could you\s+|would you\s+|will you\s+|i want you to\s+|i'd like you to\s+)?(?:please\s+)?`;
  if (new RegExp(lead + String.raw`(?:go\s+|change\s+|get\s+changed\s+)?back\s+(?:in)?to\s+(?:your\s+)?(?:original|normal|usual|old)\s+(?:outfit|clothes|look)`, "i").test(t)
    || new RegExp(lead + String.raw`wear\s+your\s+(?:original|normal|usual)\s+(?:outfit|clothes)`, "i").test(t)) return { kind: "reset" };
  const verbs = String.raw`(?:wear|try\s+on|put\s+on|dress\s+(?:yourself\s+|up\s+)?in|change\s+into|get\s+changed\s+into|change\s+(?:your\s+)?(?:outfit|clothes)\s+(?:to|into)|switch\s+(?:your\s+)?(?:outfit|clothes)\s+to)`;
  const m = t.match(new RegExp(lead + verbs + String.raw`\s+(.+)$`, "i"));
  if (!m) return null;
  const rest = m[1].trim();
  if (/^(?:this|that|it|these|those)(?:\s+(?:one|outfit|dress|top|look))?(?:\s+(?:from|in)\s+(?:the|my)\s+(?:photo|picture|pic))?$/i.test(rest)
    || /^(?:the|my)\s+(?:outfit|clothes|dress|look|one)\s+(?:in|from)\s+(?:the|my|this)\s+(?:photo|picture|pic|image)/i.test(rest)
    || /^what(?:'s| is)\s+in\s+(?:the|my)\s+(?:photo|picture|pic)/i.test(rest)) return { kind: "photo" };
  if (/^put\s+on/i.test(m[0].replace(new RegExp(lead, "i"), "")) && !CLOTHING.test(rest)) return null;
  return { kind: "describe", description: rest.slice(0, 300) };
}

export class OutfitError extends Error { constructor(public code: "wallet" | "failed" | "signin") { super(code); } }

/** One wallet-paid picture edit of Oracle's portrait. Never accepts cached or fallback pictures. */
export async function requestOutfitImage(prompt: string, clothingPhoto?: string): Promise<{ url: string; libraryId: string | null }> {
  const [{ supabase }, { requireEdgeAuthToken }, portrait] = await Promise.all([
    import("@/integrations/supabase/client"), import("@/lib/edgeAuth"), import("@/assets/avatars/oracle-futuristic-office.jpg"),
  ]);
  let token: string;
  try { token = await requireEdgeAuthToken(); } catch { throw new OutfitError("signin"); }
  const base = await toSmallDataUrl(portrait.default);
  const { data, error } = await supabase.functions.invoke("image-gen", {
    headers: { Authorization: `Bearer ${token}` },
    body: { prompt, inputImages: clothingPhoto ? [base, clothingPhoto] : [base], tier: "premium", useCache: false, libraryFallback: false, maxAttempts: 3 },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const detail = ctx?.text ? await ctx.text().catch(() => "") : String(error.message || "");
    throw new OutfitError(ctx?.status === 402 || /insufficient|coins|402/i.test(detail) ? "wallet" : "failed");
  }
  const url = data?.fallback ? null : (data?.images?.[0]?.image_url?.url || data?.images?.[0]?.url || null);
  if (!url) throw new OutfitError(data?.code === "credits_exhausted" ? "failed" : "failed");
  return { url, libraryId: data?.library_id ?? null };
}

export const STANDBY_AFTER_MS = 3 * 60 * 1000;
/** Standby loop starts after three minutes with no activity. */
export const isStandby = (lastActivity: number, now: number) => now - lastActivity >= STANDBY_AFTER_MS;
