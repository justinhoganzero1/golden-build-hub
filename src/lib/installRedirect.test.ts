import { afterEach, describe, expect, it, vi } from "vitest";
import { ANDROID_APK_DOWNLOAD_URL, ANDROID_APK_VERSION, PUBLIC_HOST, downloadApk, openProductionSite } from "./installRedirect";

describe("Android app download", () => {
  afterEach(() => vi.restoreAllMocks());

  it("downloads through the labelled .apk link and is allowed for visitors who have not signed in", () => {
    let clicked: HTMLAnchorElement | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked = this;
    });
    downloadApk();
    expect(clicked).not.toBeNull();
    expect(clicked!.href).toBe(`${ANDROID_APK_DOWNLOAD_URL}?v=${ANDROID_APK_VERSION}`);
    expect(clicked!.download).toBe("oracle-lunar.apk");
    expect(clicked!.hasAttribute("data-auth-allow")).toBe(true);
  });
});

describe("openProductionSite", () => {
  afterEach(() => vi.restoreAllMocks());

  it("inside a preview frame, opens the live site in a new tab via a real link instead of navigating the frame", () => {
    const realTop = window.top;
    Object.defineProperty(window, "top", { configurable: true, value: {} });
    let clicked: HTMLAnchorElement | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked = this;
    });
    const openSpy = vi.spyOn(window, "open");
    try {
      openProductionSite("/download");
      expect(clicked).not.toBeNull();
      expect(clicked!.href).toBe(`https://${PUBLIC_HOST}/download`);
      expect(clicked!.target).toBe("_blank");
      expect(openSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "top", { configurable: true, value: realTop });
    }
  });

  it("outside a frame, opens the live site in a new tab", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);
    openProductionSite("/");
    expect(openSpy).toHaveBeenCalledWith(`https://${PUBLIC_HOST}/`, "_blank");
  });
});
