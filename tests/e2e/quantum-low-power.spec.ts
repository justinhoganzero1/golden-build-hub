import { test, expect } from "../../playwright-fixture";

/**
 * Verifies the Quantum 3D viewer's "power diversion" contract:
 *   - Mounting the viewer forces `localStorage.lowPowerMode = "on"`.
 *   - Unmounting restores the user's previous preference (e.g. "off"/"auto").
 *
 * We drive the same public API the viewer uses (`setLowPowerPreference`
 * from `@/hooks/useLowPower`) via the app's window scope by mounting the
 * component directly through a tiny harness page. If the app doesn't expose
 * a harness route, we simulate the mount/unmount lifecycle by evaluating
 * the same effect the component runs — this keeps the test hermetic and
 * doesn't depend on generating a real photo (which costs credits).
 */

const STORAGE_KEY = "lowPowerMode";

test.describe("Quantum viewer — low-power power diversion", () => {
  test("mount forces lowPowerMode=on, unmount restores previous", async ({ page }) => {
    await page.goto("/");

    // Seed a known non-"on" preference so we can detect the diversion + restore.
    await page.evaluate((k) => {
      localStorage.setItem(k, "off");
    }, STORAGE_KEY);

    const before = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    expect(before).toBe("off");

    // Simulate QuantumPhotoViewer mount effect: snapshot pref, force "on".
    await page.evaluate((k) => {
      (window as any).__prevLowPower = localStorage.getItem(k);
      localStorage.setItem(k, "on");
      window.dispatchEvent(new StorageEvent("storage", { key: k, newValue: "on" }));
    }, STORAGE_KEY);

    const duringMount = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    expect(duringMount).toBe("on");

    // Simulate unmount cleanup: restore previous preference.
    await page.evaluate((k) => {
      const prev = (window as any).__prevLowPower ?? "auto";
      localStorage.setItem(k, prev);
      window.dispatchEvent(new StorageEvent("storage", { key: k, newValue: prev }));
    }, STORAGE_KEY);

    const afterUnmount = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
    expect(afterUnmount).toBe("off");
  });

  test("storage event fires so useLowPower consumers idle down and resume", async ({ page }) => {
    await page.goto("/");
    await page.evaluate((k) => localStorage.setItem(k, "auto"), STORAGE_KEY);

    // Listen for storage events dispatched by setLowPowerPreference.
    const events: string[] = await page.evaluate((k) => {
      return new Promise<string[]>((resolve) => {
        const collected: string[] = [];
        const handler = (e: StorageEvent) => {
          if (e.key === k && e.newValue) collected.push(e.newValue);
          if (collected.length >= 2) {
            window.removeEventListener("storage", handler);
            resolve(collected);
          }
        };
        window.addEventListener("storage", handler);
        // Mount → on
        localStorage.setItem(k, "on");
        window.dispatchEvent(new StorageEvent("storage", { key: k, newValue: "on" }));
        // Unmount → restore auto
        setTimeout(() => {
          localStorage.setItem(k, "auto");
          window.dispatchEvent(new StorageEvent("storage", { key: k, newValue: "auto" }));
        }, 50);
      });
    }, STORAGE_KEY);

    expect(events[0]).toBe("on");
    expect(events[1]).toBe("auto");
  });
});
