import { describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { validTwilioSignature } from "../../supabase/functions/_shared/webhookSignature";
describe("Twilio fail-closed signature validation", () => {
  it("rejects missing credentials and forged signatures", async () => {
    expect(await validTwilioSignature("https://example.com/hook", {}, "", "forged")).toBe(false);
    expect(await validTwilioSignature("https://example.com/hook", {}, "secret", "")).toBe(false);
  });
  it("accepts a signed body but rejects changed speech and URL", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const url = "https://example.com/hook";
    const params = { CallSid: "CA123", SpeechResult: "Hello" };
    const token = "test-token-only";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const hash = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(url + "CallSidCA123SpeechResultHello"));
    const signature = btoa(String.fromCharCode(...new Uint8Array(hash)));
    expect(await validTwilioSignature(url, params, token, signature)).toBe(true);
    expect(await validTwilioSignature(url, { ...params, SpeechResult: "Forged" }, token, signature)).toBe(false);
    expect(await validTwilioSignature(url + "?sid=other", params, token, signature)).toBe(false);
    vi.unstubAllGlobals();
  });
});