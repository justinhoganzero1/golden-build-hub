import { Battery } from "lucide-react";
import { useLowPower, type LowPowerPreference } from "@/hooks/useLowPower";

/**
 * Compact 3-way toggle for low-power mode (Auto / On / Off).
 * Persists to localStorage and broadcasts change so all components
 * that call `isLowPowerMobile()` or `useLowPower()` update immediately.
 *
 * When ON: glows, animations, prefetch warmup, and heavy polling are reduced.
 */
const OPTIONS: { value: LowPowerPreference; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

export const LowPowerToggle = () => {
  const { preference, enabled, setPreference } = useLowPower();

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Battery className="w-5 h-5 text-primary" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">Low-power mode</div>
        <div className="text-xs text-muted-foreground">
          Reduces glows, animations and background work.
          {" "}
          {preference === "auto" && (
            <span>Currently <strong>{enabled ? "active" : "off"}</strong> (auto-detect).</span>
          )}
        </div>
      </div>
      <div className="flex rounded-full bg-muted p-0.5" role="radiogroup" aria-label="Low-power mode">
        {OPTIONS.map((opt) => {
          const active = preference === opt.value;
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={active}
              onClick={() => setPreference(opt.value)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LowPowerToggle;
