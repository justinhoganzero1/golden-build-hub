import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { ownItemIds, ownSelectedIds } from "./libraryDelete";

const items = [
  { id: "a", user_id: "me" },
  { id: "b", user_id: "member" },
  { id: "c", user_id: "me" },
];

describe("library bulk delete", () => {
  it("only deletes the signed-in member's own selected items", () => {
    expect(ownSelectedIds(items, ["a", "b", "c"], "me")).toEqual(["a", "c"]);
  });
  it("select all picks only own items", () => {
    expect(ownItemIds(items, "me")).toEqual(["a", "c"]);
  });
  it("deletes nothing when signed out", () => {
    expect(ownSelectedIds(items, ["a"], null)).toEqual([]);
  });
});
