import { describe, it, expect } from "vitest";
import { isStaleAppError } from "./crashReport";

describe("isStaleAppError", () => {
  it("spots Chrome's missing app piece error", () => {
    expect(isStaleAppError("Failed to fetch dynamically imported module: https://oraclelunar.com/assets/OraclePage-abc.js")).toBe(true);
  });
  it("spots Safari's missing app piece error", () => {
    expect(isStaleAppError("Importing a module script failed.")).toBe(true);
  });
  it("does not treat ordinary bugs as stale app errors", () => {
    expect(isStaleAppError("Cannot read properties of undefined (reading 'map')")).toBe(false);
  });
});
