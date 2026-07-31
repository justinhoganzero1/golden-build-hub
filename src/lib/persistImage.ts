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
    if (!dataUrl || !dataUrl.startsWith("data:image/")) return dataUrl;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return dataUrl;

    const match = dataUrl.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
    if (!match) return dataUrl;
    const [, mime, b64] = match;
    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "png";

    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const path = `${uid}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("photography-assets")
      .upload(path, new Blob([bytes], { type: mime }), {
        contentType: mime,
        upsert: true,
      });
    if (error) throw error;

    // Store the stable canonical object URL. The bucket is private, so display
    // components resolve this canonical URL to a short-lived signed URL.
    const { data } = supabase.storage.from("photography-assets").getPublicUrl(path);
    return data?.publicUrl || dataUrl;
  } catch (e) {
    console.warn("[persistImageToStorage] falling back to data URL:", e);
    return dataUrl;
  }
}
