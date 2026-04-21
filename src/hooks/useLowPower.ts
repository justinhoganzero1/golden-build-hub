import { useEffect, useState, useCallback } from "react";
import { isLowPowerMobile } from "@/lib/utils";

export type LowPowerPreference = "auto" | "on" | "off";

const STORAGE_KEY = "lowPowerMode";

export function getLowPowerPreference(): LowPowerPreference {
  if (typeof window === "undefined") return "auto";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "on" || v === "off" || v === "auto") return v;
  } catch {}
  return "auto";
}

export function setLowPowerPreference(value: LowPowerPreference) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: value }));
  } catch {}
}

/** Resolve the effective low-power flag, honoring user override over auto-detect. */
export function resolveLowPower(pref: LowPowerPreference = getLowPowerPreference()): boolean {
  if (pref === "on") return true;
  if (pref === "off") return false;
  return isLowPowerMobile();
}

/**
 * React hook returning the effective low-power flag plus the user preference
 * and a setter. Reacts to changes from other tabs/components via the storage
 * event so the toggle in Settings updates the whole app immediately.
 */
export function useLowPower() {
  const [pref, setPrefState] = useState<LowPowerPreference>(() => getLowPowerPreference());
  const [enabled, setEnabled] = useState<boolean>(() => resolveLowPower());

  useEffect(() => {
    const recompute = () => {
      const p = getLowPowerPreference();
      setPrefState(p);
      setEnabled(resolveLowPower(p));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) recompute();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPref = useCallback((p: LowPowerPreference) => {
    setLowPowerPreference(p);
    setPrefState(p);
    setEnabled(resolveLowPower(p));
  }, []);

  return { enabled, preference: pref, setPreference: setPref };
}
