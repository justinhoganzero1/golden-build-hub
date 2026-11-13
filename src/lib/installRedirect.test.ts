import { afterEach, describe, expect, it, vi } from "vitest";
import { ANDROID_APK_URL, ANDROID_APK_VERSION, downloadApk } from "./installRedirect";

describe("Android app download", () => {
  afterEach(() => vi.restoreAllMocks());

  it("downloads the hosted APK and is allowed for visitors who have not signed in", () => {
    let clicked: HTMLAnchorElement | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked = this;
    });
    downloadApk();
    expect(clicked).not.toBeNull();
    expect(clicked!.href).toBe(`${ANDROID_APK_URL}?v=${ANDROID_APK_VERSION}`);
    expect(clicked!.hasAttribute("data-auth-allow")).toBe(true);
  });
});
