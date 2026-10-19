import { describe, expect, it } from "vitest";
import { formatWebAnswer } from "./oracleWeb";
describe("Oracle web answers", () => {
  it("shows a picture and numbered clickable sources", () => {
    const out = formatWebAnswer("TAFE runs it at night [1].", [{ url: "https://tafeqld.edu.au/x", title: "TAFE", image: "https://tafeqld.edu.au/a.jpg" }]);
    expect(out).toContain("![TAFE](https://tafeqld.edu.au/a.jpg)");
    expect(out).toContain("1. [TAFE](https://tafeqld.edu.au/x)");
  });
  it("marks answers without sources as unverified", () => {
    expect(formatWebAnswer("Hi", [])).toContain("unverified");
  });
});
