import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(), refreshSession: vi.fn(), onAuthStateChange: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

describe("paid endpoint session protection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-key");
    auth.getSession.mockResolvedValue({ data: { session: null } });
  });

  it("rejects signed-out requests instead of sending the public key", async () => {
    const { requireEdgeAuthToken } = await import("./edgeAuth");
    await expect(requireEdgeAuthToken()).rejects.toThrow("Please sign in again");
  });

  it("refreshes an expiring member token before paid work", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "expired", expires_at: Date.now() / 1000 - 1 } } });
    auth.refreshSession.mockResolvedValue({ data: { session: { access_token: "fresh" } }, error: null });
    const { requireEdgeAuthToken } = await import("./edgeAuth");
    await expect(requireEdgeAuthToken()).resolves.toBe("fresh");
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("never sends an old token when refreshing fails", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "expired", expires_at: Date.now() / 1000 - 1 } } });
    auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("expired session") });
    const { requireEdgeAuthToken } = await import("./edgeAuth");
    await expect(requireEdgeAuthToken()).rejects.toThrow("Please sign in again");
  });
});