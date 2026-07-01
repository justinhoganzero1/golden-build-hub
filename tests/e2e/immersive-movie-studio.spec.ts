import { test, expect } from "../../playwright-fixture";

/**
 * Immersive Movie Studio — behavioral E2E
 *
 * Covers:
 *  1. 20-layer audio cap (UI + toast validation)
 *  2. Project save/open round-trip via localStorage draft persistence
 *  3. Timeline reordering (arrow up/down mutates order)
 *  4. Export produces a playable MP4/WEBM artifact (Blob download)
 *
 * These tests exercise the page's client contract. They do not require an
 * authenticated Supabase session — the local autosave draft is used to
 * validate the save/open round-trip, which is the same code path the cloud
 * save writes into `data` before uploading.
 */

const PAGE = "/immersive-movie-studio";

// A tiny 2x2 PNG (red). Enough for canvas + Photo3DViewer to accept as a still.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

async function addStills(page: import("@playwright/test").Page, count: number) {
  // Programmatically create File objects and dispatch them to the hidden input.
  const buffer = Buffer.from(TINY_PNG_BASE64, "base64");
  const files = Array.from({ length: count }, (_, i) => ({
    name: `still-${i + 1}.png`,
    mimeType: "image/png",
    buffer,
  }));
  const input = page.locator('input[type="file"][accept*="image"]').first();
  await input.setInputFiles(files);
}

test.describe("Immersive Movie Studio", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  });

  test("caps audio layers at 20 with a clear error", async ({ page }) => {
    // Create 21 fake audio files
    const fakeWav = Buffer.from(
      "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
      "base64"
    );
    const files = Array.from({ length: 21 }, (_, i) => ({
      name: `track-${i + 1}.wav`,
      mimeType: "audio/wav",
      buffer: fakeWav,
    }));
    const audioInput = page.locator('input[type="file"][accept*="audio"]').first();
    await audioInput.setInputFiles(files);

    // Counter should read 20/20
    await expect(page.getByText(/20\/20/)).toBeVisible({ timeout: 5_000 });

    // Attempting to add another should surface a toast and never exceed 20
    await audioInput.setInputFiles([{ name: "extra.wav", mimeType: "audio/wav", buffer: fakeWav }]);
    await expect(page.getByText(/maximum of 20 audio layers/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/20\/20/)).toBeVisible();
  });

  test("timeline reorder swaps scene positions", async ({ page }) => {
    await addStills(page, 3);
    // Wait for scenes to render — each row has an ArrowUp/ArrowDown button
    const upButtons = page.locator('button:has(svg.lucide-arrow-up)');
    await expect(upButtons).toHaveCount(3, { timeout: 5_000 });

    // Original order: #1 still-1, #2 still-2, #3 still-3
    const names = () => page.locator('input.h-7.text-xs').all();
    const initial = await Promise.all((await names()).map((n) => n.inputValue()));
    expect(initial).toEqual(["still-1", "still-2", "still-3"]);

    // Move scene #2 up
    await upButtons.nth(1).click();
    const after = await Promise.all((await names()).map((n) => n.inputValue()));
    expect(after).toEqual(["still-2", "still-1", "still-3"]);
  });

  test("autosave persists a draft that survives reload (save/open round-trip)", async ({ page }) => {
    await addStills(page, 2);
    // Rename project so we can assert restoration.
    const nameInput = page.getByPlaceholder("Project name");
    await nameInput.fill("Round Trip Test");

    // Autosave debounce is 1.5s; wait a bit longer.
    await page.waitForTimeout(2_000);

    // Confirm localStorage draft was written with expected shape.
    const draft = await page.evaluate(() => {
      const raw = localStorage.getItem("immersive-movie:draft");
      return raw ? JSON.parse(raw) : null;
    });
    expect(draft).toBeTruthy();
    expect(draft.projectName).toBe("Round Trip Test");
    expect(Array.isArray(draft.scenes)).toBe(true);
    expect(draft.scenes.length).toBe(2);
    expect(draft.exportSettings).toBeTruthy();
    expect(draft.exportSettings.format).toMatch(/mp4|webm/);

    // Reload the page — draft should hydrate name + scene count.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByPlaceholder("Project name")).toHaveValue("Round Trip Test");
    await expect(page.getByText(/2 scenes/i)).toBeVisible({ timeout: 5_000 });
  });

  test("export produces a playable MP4/WEBM blob download", async ({ page }) => {
    await addStills(page, 1);

    // Shorten scene duration to 1s so the test doesn't hang.
    const durationInput = page.locator('input[type="number"]').first();
    await durationInput.fill("1");

    // Intercept blob URL created on the anchor to inspect the produced file.
    await page.evaluate(() => {
      (window as any).__lastDownload = null;
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.href?.startsWith("blob:")) {
          (window as any).__lastDownload = { href: this.href, download: this.download };
        }
        return origClick.apply(this);
      };
    });

    const exportBtn = page.getByRole("button", { name: /Export (MP4|WEBM)/i });
    await exportBtn.click();

    // Wait for the export to complete (~1s scene + finalize).
    await page.waitForFunction(() => (window as any).__lastDownload !== null, null, {
      timeout: 15_000,
    });

    const dl = await page.evaluate(async () => {
      const meta = (window as any).__lastDownload as { href: string; download: string };
      const blob: Blob = await fetch(meta.href).then((r) => r.blob());
      return { size: blob.size, type: blob.type, name: meta.download };
    });

    expect(dl.size).toBeGreaterThan(0);
    expect(dl.type).toMatch(/^video\/(mp4|webm)/);
    expect(dl.name).toMatch(/\.(mp4|webm)$/);
  });
});
