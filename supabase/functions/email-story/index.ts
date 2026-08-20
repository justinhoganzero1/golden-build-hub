// Delivers the complete illustrated book in one ordered email.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PRIMARY_FROM = Deno.env.get("KINDLE_FROM_EMAIL") || "Oracle Lunar Books <kindle@oracle-lunar.online>";
const FALLBACK_FROM = "Oracle Lunar Books <onboarding@resend.dev>";
const MAX_CHAPTERS = 100;
const MAX_IMAGES_PER_CHAPTER = 12;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const paras = (text: string) =>
  text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="margin:0 0 1em;line-height:1.7;font-size:16px;color:#1a1a1a">${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");

interface Chapter { title?: string; content?: string; images?: string[]; imageAnchors?: number[] }
interface StoryPayload {
  to?: string | string[];
  message?: string;
  storyId?: string;
  partNumber?: number;
  totalParts?: number;
  title?: string;
  author?: string;
  genre?: string;
  blurb?: string;
  dedication?: string;
  prelude?: string;
  coverImage?: string;
  backImage?: string;
  chapters?: Chapter[];
}

const storageRef = (url: string) => {
  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/";
    const at = parsed.pathname.indexOf(marker);
    if (at < 0) return null;
    const remainder = decodeURIComponent(parsed.pathname.slice(at + marker.length)).replace(/^(public|sign)\//, "");
    const slash = remainder.indexOf("/");
    if (slash < 1) return null;
    return { bucket: remainder.slice(0, slash), path: remainder.slice(slash + 1) };
  } catch {
    return null;
  }
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const backendUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!resendKey || !backendUrl || !anonKey || !serviceKey) return json({ error: "Email delivery is not configured." }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in to email your story." }, 401);
    const authClient = createClient(backendUrl, anonKey, {
      auth: { persistSession: false }, global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Sign in to email your story." }, 401);

    const incoming = await req.json().catch(() => null) as StoryPayload | null;
    if (!incoming) return json({ error: "Invalid request body." }, 400);
    const recipients = (Array.isArray(incoming.to) ? incoming.to : String(incoming.to ?? "").split(/[,;\s]+/))
      .map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (recipients.length !== 1) return json({ error: "Enter one valid recipient email address." }, 400);

    const service = createClient(backendUrl, serviceKey, { auth: { persistSession: false } });
    let body = incoming;
    if (incoming.storyId) {
      const { data: item, error } = await service.from("user_media").select("user_id, title, metadata").eq("id", incoming.storyId).maybeSingle();
      if (error || !item || item.user_id !== userData.user.id) return json({ error: "Story not found in your library." }, 404);
      const metadata = (item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
      body = {
        ...incoming,
        title: String(metadata.title ?? item.title ?? "Untitled Story"),
        author: String(metadata.author ?? metadata.authorName ?? ""),
        genre: String(metadata.genre ?? ""),
        blurb: String(metadata.blurb ?? ""),
        dedication: String(metadata.dedication ?? ""),
        prelude: String(metadata.prelude ?? ""),
        coverImage: String(metadata.coverImage ?? metadata.frontImage ?? ""),
        backImage: String(metadata.backImage ?? ""),
        chapters: Array.isArray(metadata.chapters) ? metadata.chapters as Chapter[] : [],
      };
    }

    const title = String(body.title ?? "Untitled Story").slice(0, 200);
    const author = String(body.author ?? "").slice(0, 120);
    const genre = String(body.genre ?? "").slice(0, 80);
    const blurb = String(body.blurb ?? "").slice(0, 10000);
    const dedication = String(body.dedication ?? "").slice(0, 5000);
    const prelude = String(body.prelude ?? "").slice(0, 50000);
    const allChapters = (Array.isArray(body.chapters) ? body.chapters : []).slice(0, MAX_CHAPTERS)
      .filter((c) => typeof c?.content === "string" && c.content.trim());
    if (!allChapters.length) return json({ error: "There's no story text to email yet." }, 400);
    const emailImageUrl = async (url: string) => {
      if (!url) return "";
      const ref = storageRef(url);
      if (ref) {
        const { data, error } = await service.storage.from(ref.bucket).createSignedUrl(ref.path, 60 * 60 * 24 * 30);
        if (error || !data?.signedUrl) throw new Error("Could not prepare a book illustration for email.");
        return data.signedUrl;
      }
      return url;
    };

    const sendMessage = async (from: string, subject: string, html: string) => {
      for (let attempt = 1; ; attempt++) {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: recipients, reply_to: userData.user.email ?? undefined, subject, html }),
        });
        const result = await response.json().catch(() => ({}));
        if (response.status === 429 && attempt < 4) {
          await new Promise((r) => setTimeout(r, 1200 * attempt));
          continue;
        }
        return { ok: response.ok, status: response.status, result };
      }
    };

    const bookParts: string[] = [];
    const coverUrl = await emailImageUrl(String(body.coverImage ?? ""));
    if (coverUrl) bookParts.push(`<img src="${esc(coverUrl)}" alt="${esc(title)} front cover" width="560" style="display:block;width:100%;max-width:560px;height:auto;margin:0 auto 24px"/>`);
    bookParts.push(`<h1 style="font-size:30px;margin:16px 0 4px;color:#111;text-align:center">${esc(title)}</h1>`);
    if (author) bookParts.push(`<p style="margin:0 0 20px;font-size:15px;color:#555;text-align:center">by ${esc(author)}</p>`);
    if (body.message) bookParts.push(`<div style="margin:22px 0">${paras(String(body.message).slice(0, 5000))}</div>`);
    if (dedication) bookParts.push(`<div style="font-style:italic;text-align:center;margin:24px 0">${paras(dedication)}</div>`);
    if (prelude) bookParts.push(`<hr style="border:none;border-top:1px solid #ddd;margin:30px 0"/><h2>Prelude</h2>${paras(prelude)}`);

    let imageCount = coverUrl ? 1 : 0;
    for (let chapterIndex = 0; chapterIndex < allChapters.length; chapterIndex++) {
      const chapter = allChapters[chapterIndex];
      const images = (chapter.images ?? []).filter(Boolean).slice(0, MAX_IMAGES_PER_CHAPTER);
      const imageHtml: string[] = [];
      for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
        const imageUrl = await emailImageUrl(images[imageIndex]);
        if (!imageUrl) continue;
        imageCount += 1;
        imageHtml.push(`<img src="${esc(imageUrl)}" alt="${esc(chapter.title || `Chapter ${chapterIndex + 1}`)} illustration" width="560" style="display:block;width:100%;max-width:560px;height:auto;margin:22px auto"/>`);
      }

      const blocks = String(chapter.content ?? "").split(/\n{2,}/).filter((p) => p.trim());
      const placed = imageHtml.map((tag, imageIndex) => ({
        tag,
        at: Math.max(0, Math.min(blocks.length, typeof chapter.imageAnchors?.[imageIndex] === "number"
          ? Number(chapter.imageAnchors[imageIndex])
          : Math.round(((imageIndex + 1) / (imageHtml.length + 1)) * blocks.length))),
      })).sort((a, b) => a.at - b.at);
      const chapterParts: string[] = [];
      let nextImage = 0;
      blocks.forEach((paragraph, paragraphIndex) => {
        while (nextImage < placed.length && placed[nextImage].at <= paragraphIndex) chapterParts.push(placed[nextImage++].tag);
        chapterParts.push(paras(paragraph));
      });
      while (nextImage < placed.length) chapterParts.push(placed[nextImage++].tag);

      bookParts.push(`<hr style="border:none;border-top:1px solid #ddd;margin:34px 0"/><p style="font-size:12px;color:#777;text-align:center">Chapter ${chapterIndex + 1} of ${allChapters.length}${genre ? ` · ${esc(genre)}` : ""}</p><h2 style="font-size:22px;color:#111">${esc(chapter.title || `Chapter ${chapterIndex + 1}`)}</h2>${chapterParts.join("")}`);
    }

    const backUrl = await emailImageUrl(String(body.backImage ?? ""));
    if (backUrl) {
      imageCount += 1;
      bookParts.push(`<hr style="border:none;border-top:1px solid #ddd;margin:36px 0"/><img src="${esc(backUrl)}" alt="${esc(title)} rear cover" width="560" style="display:block;width:100%;max-width:560px;height:auto;margin:20px auto"/>`);
    }
    if (blurb) bookParts.push(`<div style="font-style:italic;color:#444;margin:20px 0">${paras(blurb)}</div>`);

    const html = `<!doctype html><html><body style="margin:0;background:#fff"><main style="max-width:640px;margin:0 auto;padding:28px 22px;font-family:Georgia,'Times New Roman',serif;background:#fff">${bookParts.join("")}<p style="margin:34px 0 0;font-size:11px;color:#999;text-align:center">End of complete book</p></main></body></html>`;
    const subject = `${title} — Complete illustrated book (${allChapters.length} chapters)`;
    let result = await sendMessage(PRIMARY_FROM, subject, html);
    if (!result.ok && PRIMARY_FROM !== FALLBACK_FROM) result = await sendMessage(FALLBACK_FROM, subject, html);
    if (!result.ok) {
      console.error(`Complete book delivery failed [${result.status}]`, JSON.stringify(result.result));
      return json({ error: "The complete book email was not accepted for delivery.", details: result.result }, 502);
    }

    return json({ sent: true, to: recipients[0], emails: 1, chapters: allChapters.length, images: imageCount });
  } catch (error) {
    console.error("email-story error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected email error" }, 500);
  }
});