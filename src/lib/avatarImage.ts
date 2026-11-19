// Saved avatars live inside the avatar record as a picture, and every screen
// that lists avatars downloads them all. Big PNGs (~2 MB each) made the Oracle
// screen stall on tablets, so new avatar pictures are re-saved as same-size
// JPEGs (~10x smaller) before they are stored. Web links are left alone.

/** True when a picture should be re-saved smaller before storing. */
export function needsAvatarShrink(dataUrl: string | null | undefined): boolean {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return false;
  if (dataUrl.startsWith("data:image/gif")) return false; // keep animations
  return dataUrl.length > 400_000;
}

export async function shrinkAvatarImage(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl || !needsAvatarShrink(dataUrl)) return dataUrl;
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = dataUrl;
    await img.decode();
    const max = 1408;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/jpeg", 0.86);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl; // never block saving an avatar
  }
}
