import { describe, expect, it } from "vitest";
import { templateAccess, templateMetadata, templateObjectPath, isPaidTemplate } from "../../supabase/functions/_shared/templateAccess";
import { clipSource, isNewClip } from "./oracleClips";
import { memberPageAccess } from "./memberPageAccess";

const shared = { user_id: "creator", is_public: true, allow_template: true, shop_enabled: false, shop_price_cents: 0 };

describe("member templates", () => {
  it("free shared templates are open to members", () => {
    expect(templateAccess(shared, "buyer", { member: true, purchased: false })).toBe("allow");
  });
  it("creations not opted in as templates cannot be copied", () => {
    expect(templateAccess({ ...shared, allow_template: false }, "buyer", { member: true, purchased: true })).toBe("not-shared");
    expect(templateAccess({ ...shared, is_public: false }, "buyer", { member: true, purchased: true })).toBe("not-shared");
  });
  it("a creator's price must be paid before the template can be used", () => {
    const priced = { ...shared, shop_enabled: true, shop_price_cents: 300 };
    expect(isPaidTemplate(priced)).toBe(true);
    expect(templateAccess(priced, "buyer", { member: true, purchased: false })).toBe("needs-purchase");
    expect(templateAccess(priced, "buyer", { member: true, purchased: true })).toBe("allow");
  });
  it("non-members cannot use templates", () => {
    expect(templateAccess(shared, "buyer", { member: false, purchased: false })).toBe("not-member");
  });
  it("copies drop billing and personal details", () => {
    const m = templateMetadata({ prompt: "a dragon", provider_cost_cents: 40, stripe_session: "cs_1", email: "a@b.c" }, "src1", "Jo");
    expect(m).toEqual({ prompt: "a dragon", template_of: "src1", template_creator: "Jo" });
  });
  it("copied files go in the new owner's own folder", () => {
    expect(templateObjectPath("buyer", "new1", "creator/x/clip one.mp4")).toBe("buyer/templates/new1/clip_one.mp4");
  });
});

describe("Oracle video Library", () => {
  it("is part of membership, including $1 founders", () => {
    const founder = { signedIn: true, owner: false, active: true, founder: true, monthly: false, path: "/oracle-videos" };
    expect(memberPageAccess(founder)).toBe("allow");
    expect(memberPageAccess({ ...founder, active: false })).toBe("upgrade");
  });
  it("marks clips added since the last visit as new", () => {
    expect(isNewClip("2026-11-12T00:00:00Z", "2026-11-11T00:00:00Z")).toBe(true);
    expect(isNewClip("2026-11-10T00:00:00Z", "2026-11-11T00:00:00Z")).toBe(false);
  });
  it("plays site assets directly and signs private uploads", () => {
    expect(clipSource("/__l5e/assets-v1/x/ad.mp4")).toEqual({ kind: "direct", url: "/__l5e/assets-v1/x/ad.mp4" });
    expect(clipSource("abc/clip.mp4")).toEqual({ kind: "storage", path: "abc/clip.mp4" });
  });
});
