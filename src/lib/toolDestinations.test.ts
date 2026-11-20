import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ROUTE_REGISTRY } from "./oracleControl";
import { SEO_TOOL_DESTINATIONS, toolDestination } from "./toolDestinations";

const app = readFileSync("src/App.tsx", "utf8");
const seoPaths = [...app.matchAll(/"(\/[a-z0-9-]+)": \(\) => import\("\.\/pages\/SeoLandingPage"\)/g)].map(m => m[1]);

describe("tool menu destinations", () => {
  it("finds the website advert pages", () => {
    expect(seoPaths).toContain("/ai-image-generator-free");
  });

  it("never sends a tools-menu choice to a website advert page", () => {
    const bad = ROUTE_REGISTRY.filter(r => seoPaths.includes(r.path.split("?")[0]));
    expect(bad.map(r => r.label)).toEqual([]);
  });

  it("gives every advert page a real in-app destination", () => {
    const missing = seoPaths.filter(p => !SEO_TOOL_DESTINATIONS[p]);
    expect(missing).toEqual([]);
    for (const p of seoPaths) expect(seoPaths).not.toContain(SEO_TOOL_DESTINATIONS[p].split("?")[0]);
  });

  it("opens the AI Image Generator choice in the Photography Hub", () => {
    expect(toolDestination("/ai-image-generator-free")).toBe("/photography-hub");
  });
});

describe("competitor comparison pages", () => {
  it("lists the Kindroid and Nomi pages as website advert pages that open Oracle for members", () => {
    expect(seoPaths).toContain("/kindroid-alternative");
    expect(seoPaths).toContain("/nomi-ai-alternative");
    expect(toolDestination("/kindroid-alternative")).toBe("/oracle");
    expect(toolDestination("/nomi-ai-alternative")).toBe("/oracle");
  });
});
