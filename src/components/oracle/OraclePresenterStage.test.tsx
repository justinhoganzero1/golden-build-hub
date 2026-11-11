import { describe, it, expect } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import type { ReactElement } from "react";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
function render(el: ReactElement) {
  const container = document.createElement("div");
  act(() => { createRoot(container).render(el); });
  return { container };
}
import OraclePresenterStage from "./OraclePresenterStage";

const src = (c: HTMLElement) => c.querySelector("video")?.getAttribute("src") || "";
describe("Oracle standby video", () => {
  it("plays the longer standby loop when idle after inactivity", () => {
    const { container } = render(<OraclePresenterStage state="idle" standbyUrl="/standby.webm" />);
    expect(src(container)).toBe("/standby.webm");
    expect(container.querySelector("video")?.hasAttribute("loop")).toBe(true);
  });
  it("leaves standby as soon as she is thinking or speaking", () => {
    const { container } = render(<OraclePresenterStage state="speaking" standbyUrl="/standby.webm" />);
    expect(src(container)).not.toBe("/standby.webm");
  });
  it("a custom outfit keeps her still picture instead of the original-outfit loop", () => {
    const { container } = render(<OraclePresenterStage state="idle" image="/outfit.png" standbyUrl="/standby.webm" />);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/outfit.png");
  });
});
