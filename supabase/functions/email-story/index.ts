// Delivers a complete illustrated book as an ordered email volume.
// One chapter per message avoids Gmail's hard clipping threshold, while CID
// attachments make private illustrations render inside the email itself.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const chapters = (Array.isArray(body.chapters) ? body.chapters : []).slice(0, MAX_CHAPTERS)
      .filter((c) => typeof c?.content === "string" && c.content.trim());
    if (!chapters.length) return json({ error: "There's no story text to email yet." }, 400);

    const loadImage = async (url: string, cid: string) => {
      if (!url) return null;
      let bytes: Uint8Array;
      let mime = "image/jpeg";
      const ref = storageRef(url);
      if (ref) {
        const { data, error } = await service.storage.from(ref.bucket).download(ref.path);
        if (error || !data) throw new Error(`Could not load illustration ${cid}.`);
        bytes = new Uint8Array(await data.arrayBuffer());
        mime = data.type || (ref.path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load illustration ${cid}.`);
        bytes = new Uint8Array(await response.arrayBuffer());
        mime = response.headers.get("content-type") || mime;
      }
      const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
      return { filename: `${cid}.${ext}`, content: bytesToBase64(bytes), content_id: cid };
    };

    const sendMessage = async (from: string, subject: string, html: string, attachments: unknown[]) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: recipients, reply_to: userData.user.email ?? undefined, subject, html, attachments }),
      });
      const result = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, result };
    };

    const delivered: string[] = [];
    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
      const chapter = chapters[chapterIndex];
      const attachments: unknown[] = [];
      const images = (chapter.images ?? []).filter(Boolean).slice(0, MAX_IMAGES_PER_CHAPTER);
      const imageHtml: string[] = [];
      for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
        const cid = `chapter-${chapterIndex + 1}-image-${imageIndex + 1}`;
        const attachment = await loadImage(images[imageIndex], cid);
        if (attachment) {
          attachments.push(attachment);
          imageHtml.push(`<img src="cid:${cid}" alt="${esc(chapter.title || `Chapter ${chapterIndex + 1}`)} illustration" width="560" style="display:block;width:100%;max-width:560px;height:auto;margin:22px auto"/>`);
        }
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

      const front: string[] = [];
      if (chapterIndex === 0) {
        const cover = await loadImage(String(body.coverImage ?? ""), "front-cover");
        if (cover) {
          attachments.push(cover);
          front.push(`<img src="cid:front-cover" alt="${esc(title)} front cover" width="560" style="display:block;width:100%;max-width:560px;height:auto;margin:0 auto 24px"/>`);
        }
        front.push(`<h1 style="font-size:30px;margin:16px 0 4px;color:#111;text-align:center">${esc(title)}</h1>`);
        if (author) front.push(`<p style="margin:0 0 20px;font-size:15px;color:#555;text-align:center">by ${esc(author)}</p>`);
        if (dedication) front.push(`<div style="font-style:italic;text-align:center;margin:24px 0">${paras(dedication)}</div>`);
        if (prelude) front.push(`<hr style="border:none;border-top:1px solid #ddd;margin:30px 0"/><h2>Prelude</h2>${paras(prelude)}`);
      }

      const rear: string[] = [];
      if (chapterIndex === chapters.length - 1) {
        const back = await loadImage(String(body.backImage ?? ""), "rear-cover");
        if (back) {
          attachments.push(back);
          rear.push(`<hr style="border:none;border-top:1px solid #ddd;margin:36px 0"/><img src="cid:rear-cover" alt="${esc(title)} rear cover" width="560" style="display:block;width:100%;max-width:560px;height:auto;margin:20px auto"/>`);
        }
        if (blurb) rear.push(`<div style="font-style:italic;color:#444;margin:20px 0">${paras(blurb)}</div>`);
      }

      const html = `<!doctype html><html><body style="margin:0;background:#fff"><main style="max-width:640px;margin:0 auto;padding:28px 22px;font-family:Georgia,'Times New Roman',serif;background:#fff">${front.join("")}<p style="font-size:12px;color:#777;text-align:center">Part ${chapterIndex + 1} of ${chapters.length}${genre ? ` · ${esc(genre)}` : ""}</p><hr style="border:none;border-top:1px solid #ddd;margin:20px 0"/><h2 style="font-size:22px;color:#111">${esc(chapter.title || `Chapter ${chapterIndex + 1}`)}</h2>${chapterParts.join("")}${rear.join("")}<p style="margin:34px 0 0;font-size:11px;color:#999;text-align:center">End of part ${chapterIndex + 1} of ${chapters.length}</p></main></body></html>`;
      if (new TextEncoder().encode(html).length > 90000) throw new Error(`Chapter ${chapterIndex + 1} is too large for a reliable email.`);

      const subject = `[${String(chapterIndex + 1).padStart(2, "0")}/${chapters.length}] ${title} — ${chapter.title || `Chapter ${chapterIndex + 1}`}`;
      let result = await sendMessage(PRIMARY_FROM, subject, html, attachments);
      if (!result.ok && PRIMARY_FROM !== FALLBACK_FROM) result = await sendMessage(FALLBACK_FROM, subject, html, attachments);
      if (!result.ok) {
        console.error(`Book delivery failed at part ${chapterIndex + 1} [${result.status}]`, JSON.stringify(result.result));
        return json({ error: `Delivery stopped at chapter ${chapterIndex + 1}. No success was claimed.`, delivered: delivered.length, details: result.result }, 502);
      }
      delivered.push(chapter.title || `Chapter ${chapterIndex + 1}`);
    }

    return json({ sent: true, to: recipients[0], parts: delivered.length, chapters: delivered.length, images: chapters.reduce((n, c) => n + (c.images?.length ?? 0), 0) + (body.coverImage ? 1 : 0) + (body.backImage ? 1 : 0) });
  } catch (error) {
    console.error("email-story error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected email error" }, 500);
  }
});