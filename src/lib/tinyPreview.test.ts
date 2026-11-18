import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { tinyPreviewKind, wantsTinyPreview } from "./tinyPreview";

describe("Library tile snapshots", () => {
  it("new pictures and videos get a snapshot", () => {
    expect(wantsTinyPreview({ media_type: "image", created_at: "2026-11-19T00:00:00Z" })).toBe(true);
    expect(wantsTinyPreview({ media_type: "video", created_at: "2026-11-19T00:00:00Z" })).toBe(true);
    expect(wantsTinyPreview({ media_type: "gif", created_at: "2026-11-19T00:00:00Z" })).toBe(true);
  });
  it("items saved before today are left alone", () => {
    expect(wantsTinyPreview({ media_type: "video", created_at: "2026-11-17T23:00:00Z" })).toBe(false);
    expect(wantsTinyPreview({ media_type: "image", created_at: "2026-01-01T00:00:00Z" })).toBe(false);
  });
  it("music, apps and documents do not get a snapshot", () => {
    expect(wantsTinyPreview({ media_type: "audio", created_at: "2026-11-19T00:00:00Z" })).toBe(false);
    expect(tinyPreviewKind("app")).toBeNull();
    expect(tinyPreviewKind("document")).toBeNull();
  });
});
