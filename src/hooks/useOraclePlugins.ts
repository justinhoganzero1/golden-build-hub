import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { normalizePluginFavourites, pluginPreferenceKey, togglePluginFavourite } from "@/lib/oraclePlugins";

const EVENT = "oracle-plugin-favourites-changed";
function read(userId?: string) {
  if (!userId) return [];
  try { return normalizePluginFavourites(JSON.parse(localStorage.getItem(pluginPreferenceKey(userId)) || "[]")); }
  catch { return []; }
}

export function useOraclePlugins() {
  const { user } = useAuth();
  const [saved, setSaved] = useState<{ userId?: string; ids: string[] }>(() => ({ userId: user?.id, ids: read(user?.id) }));
  useEffect(() => {
    const refresh = () => setSaved({ userId: user?.id, ids: read(user?.id) });
    refresh();
    window.addEventListener(EVENT, refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [user?.id]);
  const ids = saved.userId === user?.id ? saved.ids : [];
  function toggle(id: string): boolean {
    if (!user?.id) return false;
    try {
      const next = normalizePluginFavourites(togglePluginFavourite(read(user.id), id));
      localStorage.setItem(pluginPreferenceKey(user.id), JSON.stringify(next));
      setSaved({ userId: user.id, ids: next }); window.dispatchEvent(new Event(EVENT));
      return true;
    } catch { return false; }
  }
  return { ids, toggle };
}