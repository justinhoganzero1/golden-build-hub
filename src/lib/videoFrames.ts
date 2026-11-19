/**
 * Pull a few small JPEG stills out of a video (file or signed link) in the
 * browser, so only light pictures are sent for AI reading — never the whole clip.
 */
export function frameTimes(duration: number, count: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || count <= 0) return [0];
  const n = Math.max(1, Math.floor(count));
  // Evenly spaced, skipping the very first and last moments (often black or shaky).
  return Array.from({ length: n }, (_, i) => Number(((duration * (i + 1)) / (n + 1)).toFixed(2)));
}

export async function extractVideoFrames(src: File | string, count = 6, width = 640): Promise<string[]> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  const once = (ev: string) => new Promise<void>((resolve, reject) => {
    const ok = () => { cleanup(); resolve(); };
    const bad = () => { cleanup(); reject(new Error("This video couldn't be opened on this device.")); };
    const cleanup = () => { video.removeEventListener(ev, ok); video.removeEventListener("error", bad); };
    video.addEventListener(ev, ok, { once: true });
    video.addEventListener("error", bad, { once: true });
  });
  try {
    await once("loadedmetadata");
    const scale = Math.min(1, width / (video.videoWidth || width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((video.videoWidth || width) * scale));
    canvas.height = Math.max(1, Math.round((video.videoHeight || width * 0.5625) * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This device can't read video pictures.");
    const frames: string[] = [];
    for (const t of frameTimes(video.duration, count)) {
      const seeked = once("seeked");
      video.currentTime = t;
      await seeked;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.7));
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}
