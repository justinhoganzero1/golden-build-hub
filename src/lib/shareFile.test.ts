import { beforeEach, describe, expect, it, vi } from "vitest";

const share = vi.fn();
vi.mock("./systemShare", () => ({ systemShare: (d: unknown) => share(d) }));
vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));

import { shareMadeFile } from "./shareFile";

describe("shareMadeFile", () => {
  beforeEach(() => { share.mockReset(); });

  it("attaches the real file to the share menu", async () => {
    share.mockResolvedValue("shared");
    await shareMadeFile(new Blob(["x"], { type: "video/mp4" }), "episode.mp4", "My episode");
    const sent = share.mock.calls[0][0] as { file: File };
    expect(sent.file).toBeInstanceOf(File);
    expect(sent.file.name).toBe("episode.mp4");
    expect(sent.file.type).toBe("video/mp4");
  });

  it("saves the file to the device when it can't be attached", async () => {
    share.mockResolvedValue("unavailable");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => "blob:x");
    await shareMadeFile(new Blob(["x"], { type: "video/mp4" }), "episode.mp4", "My episode");
    expect(click).toHaveBeenCalledTimes(1);
  });
});
