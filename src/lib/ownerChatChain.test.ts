import { describe, it, expect } from "vitest";
import { ownerChatChain, runChatChain } from "../../supabase/functions/_shared/ownerChatChain";

const KEYS = { openai: "sk-openai-key-123456", gemini: "AIza-gemini-key-123456", lovable: "lovable-key-123456" };
const okStream = () => new Response("data: ok\n\n", { status: 200 });

describe("owner Oracle chat order", () => {
  it("tries OpenAI first, then Gemini, then platform credits last", () => {
    const steps = ownerChatChain(KEYS, { deep: false, lovableModel: "google/gemini-3.1-flash-lite" });
    expect(steps.map(s => s.provider)).toEqual(["openai", "gemini", "lovable"]);
  });

  it("skips a key that isn't saved", () => {
    const steps = ownerChatChain({ ...KEYS, openai: null }, { deep: false, lovableModel: "m" });
    expect(steps.map(s => s.provider)).toEqual(["gemini", "lovable"]);
  });

  it("uses Gemini when OpenAI fails and never touches platform credits", async () => {
    const called: string[] = [];
    const fetchImpl = (async (url: string) => {
      called.push(url);
      return url.includes("openai.com") ? new Response("no credit", { status: 429 }) : okStream();
    }) as unknown as typeof fetch;
    const r = await runChatChain(ownerChatChain(KEYS, { deep: false, lovableModel: "m" }), () => ({}), { fetchImpl });
    expect(r.ok && r.provider).toBe("gemini");
    expect(called.some(u => u.includes("lovable"))).toBe(false);
  });

  it("falls back to platform credits only after both keys fail", async () => {
    const fetchImpl = (async (url: string) => {
      if (url.includes("lovable")) return okStream();
      if (url.includes("openai.com")) throw new Error("network down");
      return new Response("bad key", { status: 400 });
    }) as unknown as typeof fetch;
    const r = await runChatChain(ownerChatChain(KEYS, { deep: false, lovableModel: "m" }), () => ({}), { fetchImpl });
    expect(r.ok && r.provider).toBe("lovable");
    expect(r.failures.map(f => f.provider)).toEqual(["openai", "gemini"]);
  });

  it("reports failure when all three fail", async () => {
    const fetchImpl = (async () => new Response("x", { status: 402 })) as unknown as typeof fetch;
    const r = await runChatChain(ownerChatChain(KEYS, { deep: false, lovableModel: "m" }), () => ({}), { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.failures).toHaveLength(3);
  });
});
