import { ROUTE_REGISTRY } from "@/lib/oracleControl";

export const PLUGIN_GROUPS = ["All", "Everyday", "Creative", "Wellbeing", "Work"] as const;
export type PluginGroup = Exclude<typeof PLUGIN_GROUPS[number], "All">;
export interface OraclePlugin { id: string; name: string; path: string; group: PluginGroup }

const groups: Record<PluginGroup, string[]> = {
  Everyday: ["Calendar", "Alarm Clock", "Media Library", "Personal Vault", "Interpreter", "Personal Assistant"],
  Creative: ["Story Writer", "Photography Hub", "AI Music Generator", "AI Image Generator", "Movie Studio Pro", "YouTube Show Studio", "Video Editor", "Voice Studio", "Living GIF Studio", "Avatar Generator"],
  Wellbeing: ["AI Fitness Coach", "Mind Hub", "Crisis Hub", "AI Tutor", "Elderly Care", "AI Cooking Assistant", "AI Travel Planner"],
  Work: ["App Builder", "AI Coder", "Inventor", "Professional Hub", "AI Email Writer", "AI Resume Builder", "AI Interview Coach"],
};

export const ORACLE_PLUGINS: OraclePlugin[] = Object.entries(groups).flatMap(([group, names]) =>
  names.flatMap(name => {
    const route = ROUTE_REGISTRY.find(r => r.label === name);
    return route ? [{ id: name, name, path: route.path, group: group as PluginGroup }] : [];
  }),
);

export function pluginPreferenceKey(userId: string) { return `oracle-plugin-favourites:v1:${userId}`; }

/** No count cap; unknown entries are dropped, without changing tool permissions. */
export function normalizePluginFavourites(value: unknown, knownIds = ORACLE_PLUGINS.map(p => p.id)): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(knownIds);
  return [...new Set(value.filter((id): id is string => typeof id === "string" && known.has(id)))];
}

export function togglePluginFavourite(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
}