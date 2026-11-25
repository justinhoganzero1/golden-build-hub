import { describe, expect, it } from "vitest";
import { PUBLIC_TOOL_HOOKS, publicHookDestination, publicHookPrice } from "./publicToolHooks";

describe("public tool access", () => {
  it("keeps App Builder paid at Pro A$24.99 per month", () => {
    const builder = PUBLIC_TOOL_HOOKS.find(tool => tool.name === "App Builder");
    expect(builder?.plan).toBe("pro");
    expect(publicHookPrice(builder?.plan ?? "free")).toBe("Pro · A$24.99/month");
  });
  it("requires sign-in before opening a member tool", () => {
    expect(publicHookDestination("/app-builder", false)).toBe("/sign-in?mode=signup&redirect=%2Fapp-builder");
    expect(publicHookDestination("/app-builder", true)).toBe("/app-builder");
  });
  it("preserves the full Oracle question across sign-up", () => {
    const path = "/oracle?ask=Plan%20a%20trip";
    const destination = new URL(publicHookDestination(path, false), "https://oraclelunar.com");
    expect(destination.searchParams.get("redirect")).toBe(path);
  });
});