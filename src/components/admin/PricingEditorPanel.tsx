import { useEffect, useState } from "react";
import { DollarSign, Save, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSiteContent, saveContent, deleteContent } from "@/hooks/useSiteContent";

/**
 * Admin-only editor for the prices displayed on the Subscribe page and landing
 * "balloons". Edits live in the `site_content` table under page=`pricing`,
 * slot=`<key>.price` / `<key>.original`. The Subscribe page reads these via
 * `useSiteContent` and falls back to the hard-coded defaults.
 *
 * IMPORTANT: This is display-only. The actual Stripe priceId is never changed
 * here, so customer billing is unaffected — exactly what the soft-launch
 * disclaimer on the Subscribe page promises.
 */
const ROWS: Array<{ key: string; label: string; defaultPrice: string; defaultOriginal: string }> = [
  { key: "starter",   label: "Starter (monthly)",      defaultPrice: "$5",     defaultOriginal: "$6.25" },
  { key: "monthly",   label: "Full Access (monthly)",  defaultPrice: "$10",    defaultOriginal: "$12.50" },
  { key: "quarterly", label: "Pro (3-month one-time)", defaultPrice: "$20",    defaultOriginal: "$25" },
  { key: "golden",    label: "Golden Heart (annual)",  defaultPrice: "$1,200", defaultOriginal: "$1,500" },
  { key: "lifetime",  label: "Lifetime (one-time)",    defaultPrice: "$900",   defaultOriginal: "$1,125" },
];

const PricingEditorPanel = () => {
  const { get, isLoaded } = useSiteContent();
  const [draft, setDraft] = useState<Record<string, { price: string; original: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Hydrate draft from site_content once loaded
  useEffect(() => {
    if (!isLoaded) return;
    const next: typeof draft = {};
    for (const r of ROWS) {
      next[r.key] = {
        price: get("pricing", `${r.key}.price`, r.defaultPrice),
        original: get("pricing", `${r.key}.original`, r.defaultOriginal),
      };
    }
    setDraft(next);
  }, [isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (key: string, field: "price" | "original", value: string) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));

  const save = async (key: string) => {
    setSaving(key);
    try {
      await saveContent("pricing", `${key}.price`, draft[key].price, "text");
      await saveContent("pricing", `${key}.original`, draft[key].original, "text");
      toast.success(`${key} prices saved — live everywhere instantly`);
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const reset = async (key: string) => {
    setSaving(key);
    try {
      await deleteContent("pricing", `${key}.price`);
      await deleteContent("pricing", `${key}.original`);
      const def = ROWS.find((r) => r.key === key)!;
      setDraft((d) => ({ ...d, [key]: { price: def.defaultPrice, original: def.defaultOriginal } }));
      toast.success(`${key} reverted to default`);
    } catch (e: any) {
      toast.error(e?.message || "Reset failed");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Pricing Editor (display-only)</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">
        These edits change <strong>only the prices shown</strong> on the Subscribe page and landing balloons.
        Stripe charges are still controlled by the priceIds in the codebase — billing is unaffected.
      </p>

      <div className="space-y-3">
        {ROWS.map((r) => {
          const row = draft[r.key] || { price: r.defaultPrice, original: r.defaultOriginal };
          const isDirty = row.price !== get("pricing", `${r.key}.price`, r.defaultPrice)
            || row.original !== get("pricing", `${r.key}.original`, r.defaultOriginal);
          return (
            <div key={r.key} className="grid grid-cols-[1fr,auto,auto,auto] gap-2 items-end border-b border-border/40 pb-3">
              <div className="col-span-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                {r.label}
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Display price</label>
                <input
                  value={row.price}
                  onChange={(e) => update(r.key, "price", e.target.value)}
                  className="w-full mt-0.5 bg-secondary border border-border rounded px-2 py-1.5 text-sm text-foreground"
                  placeholder={r.defaultPrice}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">MSRP (struck)</label>
                <input
                  value={row.original}
                  onChange={(e) => update(r.key, "original", e.target.value)}
                  className="w-32 mt-0.5 bg-secondary border border-border rounded px-2 py-1.5 text-sm text-foreground"
                  placeholder={r.defaultOriginal}
                />
              </div>
              <button
                onClick={() => save(r.key)}
                disabled={!isDirty || saving === r.key}
                className="px-3 py-1.5 mt-4 rounded bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
              >
                {saving === r.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
              </button>
              <button
                onClick={() => reset(r.key)}
                disabled={saving === r.key}
                className="px-2 py-1.5 mt-4 rounded bg-secondary text-muted-foreground text-xs flex items-center gap-1"
                title="Revert to code default"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PricingEditorPanel;
