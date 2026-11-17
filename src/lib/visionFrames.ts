// Turns an attached picture into small JPEG frames Oracle's AI can look at.
// Photos/pictures → one frame. Animated GIFs → up to 4 evenly spaced frames
// (where the browser can decode them) so Oracle can tell what happens in the clip.
import { toSmallDataUrl } from "@/lib/oracleOutfit";

const MAX_SIDE = 1280;
const MAX_GIF_FRAMES = 4;

function frameToJpeg(source: CanvasImageSource, w: number, h: number, max = 768): string {
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function gifFrames(file: Blob): Promise<string[] | null> {
  const Decoder = (globalThis as any).ImageDecoder;
  if (!Decoder) return null;
  try {
    const decoder = new Decoder({ data: await file.arrayBuffer(), type: "image/gif" });
    await decoder.tracks.ready;
    const count: number = decoder.tracks.selectedTrack?.frameCount || 1;
    if (count <= 1) { decoder.close?.(); return null; }
    const picks = Array.from(new Set(Array.from({ length: Math.min(MAX_GIF_FRAMES, count) }, (_, i) => Math.floor((i * (count - 1)) / Math.max(1, Math.min(MAX_GIF_FRAMES, count) - 1)))));
    const out: string[] = [];
    for (const frameIndex of picks) {
      const { image } = await decoder.decode({ frameIndex });
      out.push(frameToJpeg(image, image.displayWidth, image.displayHeight));
      image.close();
    }
    decoder.close?.();
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/** Returns 0–4 small JPEG data URLs for the AI to view; empty if the picture can't be read. */
export async function imageToVisionFrames(file: Blob & { type: string }): Promise<string[]> {
  if (file.type === "image/gif") {
    const frames = await gifFrames(file);
    if (frames) return frames;
  }
  try {
    return [await toSmallDataUrl(file, MAX_SIDE)];
  } catch {
    return [];
  }
}

/** Builds the chat content for a user turn, attaching picture frames when present. */
export function withVisionImages(text: string, images?: string[]) {
  if (!images?.length) return text;
  return [{ type: "text" as const, text }, ...images.slice(0, 4).map((url) => ({ type: "image_url" as const, image_url: { url } }))];
}
