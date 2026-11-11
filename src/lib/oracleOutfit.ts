// Oracle outfit changes: the member's chosen outfit is saved per account on this device.
export interface OracleOutfit { url: string; label: string; libraryId?: string | null }

export const OUTFIT_PRESETS: { id: string; label: string; description: string }[] = [
  { id: "evening", label: "Evening gown", description: "an elegant floor-length black evening gown with subtle gold detail" },
  { id: "casual", label: "Casual", description: "relaxed blue jeans and a soft white t-shirt with a light denim jacket" },
  { id: "business", label: "Business suit", description: "a sharp tailored navy business suit with a cream blouse" },
  { id: "sporty", label: "Sporty", description: "smart modern activewear: a fitted zip-up track jacket and leggings" },
  { id: "cosy", label: "Cosy jumper", description: "a cosy oversized knitted cream jumper" },
  { id: "summer", label: "Summer dress", description: "a bright, floaty floral summer dress" },
];

const key = (userId: string) => `oracle-outfit:v1:${userId}`;

export function loadOutfit(userId: string | undefined): OracleOutfit | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(key(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.url === "string" && parsed.url ? parsed : null;
  } catch { return null; }
}

export function saveOutfit(userId: string, outfit: OracleOutfit | null) {
  try {
    if (!outfit) localStorage.removeItem(key(userId));
    else localStorage.setItem(key(userId), JSON.stringify(outfit));
    return true;
  } catch { return false; }
}

/** Instruction for dressing Oracle; image 1 is always her portrait. */
export function outfitPrompt(source: { photo: true } | { description: string }) {
  const outfit = "photo" in source
    ? "the outfit shown in the second image (copy its clothing style, colours, fabric and details; ignore any person, face or background in that photo)"
    : source.description;
  return `Edit the first image. Dress the woman in ${outfit}. Keep her face, identity, skin tone, hair, expression, pose, framing, lighting and the futuristic office background exactly the same; change only her clothing. Photorealistic, natural fit. Keep it tasteful and fully clothed (suitable for all ages): if the outfit is revealing, make a modest version of it.`;
}

/** Shrinks a picture to a JPEG data URL so uploads stay small. */
export async function toSmallDataUrl(src: Blob | string, max = 1024): Promise<string> {
  const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("Could not read that picture")); i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally { URL.revokeObjectURL(url); }
}
