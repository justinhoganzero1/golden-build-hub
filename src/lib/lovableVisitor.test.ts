import { describe, it, expect } from "vitest";
import { cameFromLovable } from "./lovableVisitor";

describe("visitors arriving from Lovable see the funny ad first", () => {
  it("detects a click from Lovable's site", () => {
    expect(cameFromLovable({ referrer: "https://lovable.dev/projects/abc", ownHost: "oraclelunar.com" })).toBe(true);
  });
  it("detects the app shown inside a Lovable page", () => {
    expect(cameFromLovable({ ancestorOrigins: ["https://lovable.dev"], ownHost: "oraclelunar.com" })).toBe(true);
  });
  it("honours the ?from=lovable link", () => {
    expect(cameFromLovable({ search: "?from=lovable", ownHost: "oraclelunar.com" })).toBe(true);
  });
  it("leaves Google and direct visitors on the normal page", () => {
    expect(cameFromLovable({ referrer: "https://www.google.com/", ownHost: "oraclelunar.com" })).toBe(false);
    expect(cameFromLovable({ referrer: "", ownHost: "oraclelunar.com" })).toBe(false);
  });
  it("does not treat a look-alike address as Lovable", () => {
    expect(cameFromLovable({ referrer: "https://notlovable.dev/", ownHost: "oraclelunar.com" })).toBe(false);
  });
});
