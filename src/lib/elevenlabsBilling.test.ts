import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorizeAI: vi.fn(), settleAI: vi.fn(), cancelAI: vi.fn() }));
vi.mock("../../supabase/functions/_shared/requireAuth.ts", () => ({
  requireUser: vi.fn(async () => ({ user: { id: "member", email: null } })),
  enforceRateLimit: vi.fn(async () => undefined),
}));
vi.mock("../../supabase/functions/_shared/wallet.ts", () => ({
  ...mocks, InsufficientCoinsError: class extends Error {}, insufficientCoinsResponse: vi.fn(),
}));
vi.mock("../../supabase/functions/_shared/pricing.ts", () => ({ PROVIDER_RATES: { elevenlabs_tts_per_1000_chars: 30 } }));

let handler: (request: Request) => Promise<Response>;
describe("TTS payment and timeout protection", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.defineProperty(AbortSignal, "timeout", { configurable: true, value: () => new AbortController().signal });
    vi.stubGlobal("Deno", { env: { get: () => "configured" }, serve: (fn: typeof handler) => { handler = fn; } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "audio/mpeg" } })));
    mocks.authorizeAI.mockResolvedValue({ transaction_id: "transaction" });
    mocks.settleAI.mockResolvedValue({});
    const functionPath = "../../supabase/functions/elevenlabs-tts/index.ts";
    await import(/* @vite-ignore */ functionPath);
  });
  const request = () => new Request("https://app.test/tts", { method: "POST", body: JSON.stringify({ text: "Hello Juzzy" }) });

  it("does not call the paid provider when authorization fails", async () => {
    mocks.authorizeAI.mockRejectedValue(new Error("billing timeout"));
    const response = await handler(request());
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not release paid audio when settlement fails", async () => {
    mocks.settleAI.mockRejectedValue(new Error("billing timeout"));
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("billing_unavailable");
  });
  it("reserves then settles exact character usage before returning audio", async () => {
    const response = await handler(request());
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(mocks.authorizeAI.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(fetch).mock.invocationCallOrder[0]);
    expect(mocks.settleAI).toHaveBeenCalledWith("transaction", 1, undefined, [{ unit_type: "character", quantity: 11 }], expect.any(Object), expect.any(AbortSignal));
  });
});