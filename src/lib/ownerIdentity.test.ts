import { describe, expect, it } from "vitest";
import { isOwnerEmail, sha256Hex } from "./ownerIdentity";

describe("owner email stays out of public code", () => {
  it("hashes like standard SHA-256", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("recognises the owner, ignoring case and spaces", () => {
    expect(isOwnerEmail(" JustinBrettHogan@gmail.com ")).toBe(true);
  });
  it("refuses everyone else", () => {
    expect(isOwnerEmail("someone@gmail.com")).toBe(false);
    expect(isOwnerEmail("")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
  });
});
