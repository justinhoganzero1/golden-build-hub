import { expect, it } from "vitest";
import { libraryQueueKey, canDrainLibraryQueue } from "./libraryQueueScope";
it("never shares queued creations between signed-in accounts", () => {
  expect(libraryQueueKey("a")).not.toBe(libraryQueueKey("b"));
  expect(canDrainLibraryQueue("a", "b")).toBe(false);
  expect(canDrainLibraryQueue("a", undefined)).toBe(false);
  expect(canDrainLibraryQueue("a", "a")).toBe(true);
});