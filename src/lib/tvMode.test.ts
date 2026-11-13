import { describe, expect, it } from "vitest";
import { isTvUserAgent, pickNext, type Box } from "./tvMode";

const b = (left: number, top: number, w = 100, h = 40): Box => ({ left, top, right: left + w, bottom: top + h });

describe("Google TV detection", () => {
  it("recognises the installed app on a TV and common TV browsers", () => {
    expect(isTvUserAgent("Mozilla/5.0 (Linux; Android 12; wv) Chrome/120 OracleLunarTV")).toBe(true);
    expect(isTvUserAgent("Mozilla/5.0 (Linux; Android 11; BRAVIA 4K) AppleWebKit")).toBe(true);
    expect(isTvUserAgent("Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit")).toBe(true);
  });
  it("leaves phones and computers alone", () => {
    expect(isTvUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit Mobile Safari")).toBe(false);
    expect(isTvUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120")).toBe(false);
  });
});

describe("remote arrow keys", () => {
  const start = b(100, 100);
  const below = b(100, 200);
  const right = b(300, 100);
  const farBelowLeft = b(0, 400);
  const items = [below, right, farBelowLeft];

  it("down goes to the button underneath", () => {
    expect(pickNext(start, "down", items)).toBe(0);
  });
  it("right goes to the button beside it", () => {
    expect(pickNext(start, "right", items)).toBe(1);
  });
  it("up finds nothing when there is nothing above", () => {
    expect(pickNext(start, "up", items)).toBe(-1);
  });
});
