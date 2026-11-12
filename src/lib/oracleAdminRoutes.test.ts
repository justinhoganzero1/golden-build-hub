import { describe, it, expect } from "vitest";
import { isAdminOnlyPath } from "./oracleAdminRoutes";

describe("owner-only pages stay hidden from normal members", () => {
  it("hides the admin editor and the owner dashboard", () => {
    expect(isAdminOnlyPath("/admin/editor")).toBe(true);
    expect(isAdminOnlyPath("/owner-dashboard")).toBe(true);
  });

  it("hides every other admin page, including query strings", () => {
    expect(isAdminOnlyPath("/admin/usage-audit")).toBe(true);
    expect(isAdminOnlyPath("/admin/users?tab=pending")).toBe(true);
    expect(isAdminOnlyPath("/owner-dashboard?from=menu")).toBe(true);
  });

  it("keeps every normal member page visible", () => {
    for (const path of [
      "/oracle",
      "/dashboard",
      "/media-library",
      "/creator-studio",
      "/module-shop",
      "/founder-vault",
      "/realm-builder",
      "/subscribe",
    ]) {
      expect(isAdminOnlyPath(path)).toBe(false);
    }
  });

  it("does not mistake a member page that merely starts with 'admin'", () => {
    expect(isAdminOnlyPath("/administrators-guide")).toBe(false);
    expect(isAdminOnlyPath("/administer")).toBe(false);
  });
});
