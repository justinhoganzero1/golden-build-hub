import { supabase } from "@/integrations/supabase/client";

/**
 * Turn a base64 data URL into a permanent storage URL.
 *
 * Story documents used to embed multi-megabyte base64 images directly in the
 * saved metadata, which made stories slow to open and forced the loader to
 * strip artwork (so pictures "vanished" on refresh). Uploading to storage keeps
 * the saved document tiny and the artwork permanent.
 *
 * Falls back to the original data URL if anything goes wrong so the user never
 * loses the picture they just made.
 */
export async function persistImageToStorage(
  dataUrl: string,
  folder = "stories",
): Promise<string> {
  try {
    if (!dataUrl) return dataUrl;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return dataUrl;

    let mime = "image/png";
    let blob: Blob;
    const match = dataUrl.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
    if (match) {
      mime = match[1];
      const bin = atob(match[2]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      blob = new Blob([bytes], { type: mime });
    } else if (/^https?:\/\//i.test(dataUrl)) {
      // Model providers can return short-lived remote URLs. Copy the bytes into
      // our private storage immediately so covers still work after refresh.
      const response = await fetch(dataUrl);
      if (!response.ok) throw new Error(`Could not copy generated image (${response.status})`);
      blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("Generated file is not an image");
      mime = blob.type;
    } else {
      return dataUrl;
    }
    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "png";

    const path = `${uid}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("photography-assets")
      .upload(path, blob, {
        contentType: mime,
        upsert: true,
      });
    if (error) throw error;

    // Store the stable canonical object URL. The bucket is private, so display
    // components resolve this canonical URL to a short-lived signed URL.
    const { data } = supabase.storage.from("photography-assets").getPublicUrl(path);
    return data?.publicUrl || dataUrl;
  } catch (e) {
    // Loud, not silent: a data-URL fallback is stripped by the story loader, so
    // the artwork would quietly disappear on the next reload if we said nothing.
    console.warn("[persistImageToStorage] falling back to data URL:", e);
    toast.warning("That image could not be saved permanently — regenerate it before closing the story.");
    return dataUrl;
  }
}

