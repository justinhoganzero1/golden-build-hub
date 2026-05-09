import { DollarSign, Globe, ShoppingBag } from "lucide-react";

export interface PublishSellState {
  is_public: boolean;
  shop_enabled: boolean;
  shop_price_cents: number;
}

interface Props {
  value: PublishSellState;
  onChange: (next: PublishSellState) => void;
  /** Item kind label, e.g. "photo", "app", "story". */
  kind?: string;
  /** Hide the public toggle (e.g. when something is always public). */
  hidePublic?: boolean;
  className?: string;
}

/**
 * Reusable opt-in publish + sell box.
 * Lets a creator tick to share to the Public Library and (optionally)
 * list it in the Creators Shop with a price (creator keeps 70%).
 */
export const PublishSellControls = ({
  value,
  onChange,
  kind = "creation",
  hidePublic = false,
  className = "",
}: Props) => {
  const dollars = (value.shop_price_cents || 0) / 100;
  return (
    <div
      className={`rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-amber-500/10 p-3 space-y-2.5 ${className}`}
    >
      {!hidePublic && (
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 accent-primary"
            checked={value.is_public}
            onChange={(e) =>
              onChange({
                ...value,
                is_public: e.target.checked,
                // Selling requires public visibility
                shop_enabled: e.target.checked ? value.shop_enabled : false,
              })
            }
          />
          <span className="text-xs text-foreground flex-1">
            <span className="inline-flex items-center gap-1 font-semibold">
              <Globe className="w-3.5 h-3.5 text-primary" /> Share publicly
            </span>
            <span className="block text-[11px] text-muted-foreground">
              Show this {kind} in the Public Library so other members can view it.
            </span>
          </span>
        </label>
      )}

      <label
        className={`flex items-start gap-2 cursor-pointer ${
          !hidePublic && !value.is_public ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <input
          type="checkbox"
          className="mt-1 accent-primary"
          checked={value.shop_enabled}
          onChange={(e) =>
            onChange({
              ...value,
              shop_enabled: e.target.checked,
              is_public: e.target.checked ? true : value.is_public,
            })
          }
        />
        <span className="text-xs text-foreground flex-1">
          <span className="inline-flex items-center gap-1 font-semibold">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" /> Sell this {kind}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            List it in the Creators Shop. You keep 70% of every sale.
          </span>
        </span>
      </label>

      {value.shop_enabled && (
        <div className="flex items-center gap-2 pl-6">
          <DollarSign className="w-4 h-4 text-amber-400" />
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={dollars || ""}
            onChange={(e) => {
              const v = Number(e.target.value);
              onChange({
                ...value,
                shop_price_cents: Number.isFinite(v) && v > 0 ? Math.round(v * 100) : 0,
              });
            }}
            placeholder="Price (USD)"
            className="flex-1 px-2 py-1.5 rounded-lg bg-input border border-border text-foreground text-xs outline-none focus:border-primary"
          />
          <span className="text-[11px] text-muted-foreground">USD</span>
        </div>
      )}
    </div>
  );
};

export const defaultPublishSellState: PublishSellState = {
  is_public: false,
  shop_enabled: false,
  shop_price_cents: 0,
};

export default PublishSellControls;
