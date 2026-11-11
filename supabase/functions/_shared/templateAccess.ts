// Pure rules for "use a shared creation as a template". No imports so the
// browser tests and the server function share exactly the same logic.

export interface TemplateSource {
  user_id: string;
  is_public: boolean;
  allow_template: boolean;
  shop_enabled: boolean;
  shop_price_cents: number;
}

export type TemplateDecision = "allow" | "not-shared" | "own-item" | "not-member" | "needs-purchase";

/** A template costs money only when its creator switched on the shop and set a price. */
export function isPaidTemplate(src: Pick<TemplateSource, "shop_enabled" | "shop_price_cents">): boolean {
  return !!src.shop_enabled && (src.shop_price_cents || 0) > 0;
}

export function templateAccess(
  src: TemplateSource,
  userId: string,
  opts: { member: boolean; purchased: boolean },
): TemplateDecision {
  if (!src.is_public || !src.allow_template) return "not-shared";
  if (src.user_id === userId) return "own-item";
  if (!opts.member) return "not-member";
  if (isPaidTemplate(src) && !opts.purchased) return "needs-purchase";
  return "allow";
}

const PRIVATE_KEY = /cost|price|payment|stripe|wallet|charge|billing|invoice|token|secret|email|phone|address/i;

/** Copy the creator's settings (prompt, style, chapters…) without billing or personal fields. */
export function templateMetadata(
  meta: unknown,
  sourceId: string,
  creator: string | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
      if (!PRIVATE_KEY.test(k)) out[k] = v;
    }
  }
  out.template_of = sourceId;
  out.template_creator = creator || "Member";
  return out;
}

/** New storage location inside the buyer's own folder, keeping the file name. */
export function templateObjectPath(userId: string, newId: string, oldPath: string): string {
  const name = (oldPath.split("/").pop() || "file").replace(/[^\w.\-]+/g, "_");
  return `${userId}/templates/${newId}/${name}`;
}
