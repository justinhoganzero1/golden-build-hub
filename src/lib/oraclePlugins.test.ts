import { describe, expect, it } from "vitest";
import { normalizePluginFavourites, ORACLE_PLUGINS, pluginPreferenceKey, togglePluginFavourite } from "./oraclePlugins";

describe("plugin favourites", () => {
  it("keeps all 1000 available favourites without a plugin-count cap", () => {
    const known = Array.from({ length: 1000 }, (_, i) => `plugin-${i}`);
    expect(normalizePluginFavourites(known, known)).toEqual(known);
  });
  it("isolates two accounts' preferences", () => {
    expect(pluginPreferenceKey("account-a")).not.toBe(pluginPreferenceKey("account-b"));
  });
  it("adds and removes without losing other selections", () => {
    expect(togglePluginFavourite(["Calendar"], "Story Writer")).toEqual(["Calendar", "Story Writer"]);
    expect(togglePluginFavourite(["Calendar", "Story Writer"], "Calendar")).toEqual(["Story Writer"]);
  });
  it("never includes owner-only or advert pages in member plugins", () => {
    expect(ORACLE_PLUGINS.length).toBeGreaterThan(20);
    expect(ORACLE_PLUGINS.filter(p => p.path.startsWith("/admin") || p.path === "/owner-dashboard")).toEqual([]);
    expect(ORACLE_PLUGINS.find(p => p.id === "AI Fitness Coach")?.path).toBe("/fitness-coach");
  });
  it("ignores invalid preferences and unknown tools", () => {
    expect(normalizePluginFavourites(["Calendar", "Calendar", "made-up", 42])).toEqual(["Calendar"]);
    expect(normalizePluginFavourites(null)).toEqual([]);
  });
});