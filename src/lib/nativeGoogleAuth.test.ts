import { describe, expect, it } from "vitest";
import { appReturnLink, newHandoffKey, openSession, sealSession, sealedFromAppLink } from "./nativeGoogleAuth";

describe("native Google sign-in hand-back", () => {
  it("only the app's own key opens the sealed session", async () => {
    const k = newHandoffKey();
    const sealed = await sealSession(k, { access_token: "acc", refresh_token: "ref" });
    expect(await openSession(k, sealed)).toEqual({ access_token: "acc", refresh_token: "ref" });
    await expect(openSession(newHandoffKey(), sealed)).rejects.toBeTruthy();
  });
  it("reads the sealed session back from the app link", async () => {
    const sealed = await sealSession(newHandoffKey(), { access_token: "a", refresh_token: "r" });
    expect(sealedFromAppLink(appReturnLink(sealed))).toBe(sealed);
    expect(sealedFromAppLink("https://evil.example/auth#d=abc")).toBeNull();
  });
});
