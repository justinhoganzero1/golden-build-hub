import { describe, it, expect } from "vitest";
import { shouldRemindLowBalance } from "./lowBalance";

const DAY = 24 * 60 * 60 * 1000;

describe("low wallet reminder", () => {
  it("reminds once the balance drops under A$1", () => {
    expect(shouldRemindLowBalance(99, null, 0)).toBe(true);
    expect(shouldRemindLowBalance(100, null, 0)).toBe(false);
  });
  it("reminds at most once a day", () => {
    expect(shouldRemindLowBalance(50, 0, DAY - 1)).toBe(false);
    expect(shouldRemindLowBalance(50, 0, DAY)).toBe(true);
  });
});
