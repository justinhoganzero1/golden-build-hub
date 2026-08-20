// Emails an entire story — every chapter plus every illustration — to a
// recipient. No link back to the app is required: the email IS the book.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PRIMARY_FROM = Deno.env.get("KINDLE_FROM_EMAIL") || "Oracle Lunar Books <kindle@oracle-lunar.online>";
const FALLBACK_FROM = "Oracle Lunar Books <onboarding@resend.dev>";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const paras = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 1em;line-height:1.7;font-size:16px;color:#1a1a1a">${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");

const imgTag = (src: string, alt: string) =>
  /^https?:\/\//i.test(src)
    ? `<img src="${esc(src)}" alt="${esc(alt)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;margin:20px auto;border-radius:10px" />`
    : "";

interface Chapter { title?: string; content?: string; images?: string[]; imageAnchors?: number[] }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "Email delivery is not configured yet." }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in to email your story." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Sign in to email your story." }, 401);

    const body = await req.json().catch(() => null) as {
      to?: string | string[];
      message?: string;
      title?: string;
      author?: string;
      genre?: string;
      blurb?: string;
      dedication?: string;
      prelude?: string;
      coverImage?: string;
      backImage?: string;
      chapters?: Chapter[];
      attachment?: { filename?: string; contentBase64?: string };
    } | null;
    if (!body) return json({ error: "Invalid request body." }, 400);

    const recipients = (Array.isArray(body.to) ? body.to : String(body.to ?? "").split(/[,;\s]+/))
      .map((e) => String(e).trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (recipients.length !== 1) {
      return json({ error: "Enter one valid recipient email address." }, 400);
    }

    const title = String(body.title ?? "Untitled Story").slice(0, 200);
    const author = String(body.author ?? "").slice(0, 120);
    const genre = String(body.genre ?? "").slice(0, 80);
    const blurb = String(body.blurb ?? "").slice(0, 2000);
    const dedication = String(body.dedication ?? "").slice(0, 2000);
    const prelude = String(body.prelude ?? "").slice(0, 20000);
    const note = String(body.message ?? "").slice(0, 4000);
    const chapters = Array.isArray(body.chapters) ? body.chapters.slice(0, 200) : [];
    if (!chapters.some((c) => (c.content ?? "").trim())) {
      return json({ error: "There's no story text to email yet." }, 400);
    }

    const parts: string[] = [];
    // ---- FRONT COVER ----
    parts.push(
      `<div style="text-align:center;padding:8px 0 20px">
        ${body.coverImage ? imgTag(String(body.coverImage), `${title} front cover`) : ""}
        <h1 style="font-size:30px;margin:16px 0 4px;color:#111">${esc(title)}</h1>
        ${author ? `<p style="margin:0;font-size:15px;color:#555">by ${esc(author)}</p>` : ""}
        ${genre ? `<p style="margin:6px 0 0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a6a1f">${esc(genre)}</p>` : ""}
      </div>`,
    );
    if (note) parts.push(`<div style="border-left:3px solid #d4af37;padding:4px 14px;margin:0 0 24px">${paras(note)}</div>`);
    // ---- DEDICATION ----
    if (dedication) {
      parts.push(
        `<div style="text-align:center;font-style:italic;color:#444;margin:0 0 28px">${paras(dedication)}</div>`,
      );
    }
    // ---- PRELUDE ----
    if (prelude) {
      parts.push(
        `<hr style="border:none;border-top:1px solid #e6e6e6;margin:34px 0" />
         <h2 style="font-size:22px;margin:0 0 14px;color:#111">Prelude</h2>
         ${paras(prelude)}`,
      );
    }

    chapters.forEach((c, i) => {
      const text = (c.content ?? "").trim();
      if (!text) return;
      const images = (c.images ?? []).filter(Boolean).slice(0, 12);
      const anchors = c.imageAnchors ?? [];
      const blocks = text.split(/\n{2,}/).filter((p) => p.trim());
      const alt = `${c.title ?? `Chapter ${i + 1}`} illustration`;
      let html = "";
      // Each illustration sits at the paragraph the AI anchored it to; older
      // stories with no anchors fall back to an even spread.
      const placed = images.map((img, k) => ({
        img,
        at: Math.max(0, Math.min(blocks.length, typeof anchors[k] === "number"
          ? Number(anchors[k])
          : Math.round(((k + 1) / (images.length + 1)) * blocks.length))),
      })).sort((a, b) => a.at - b.at);
      let next = 0;
      blocks.forEach((p, idx) => {
        while (next < placed.length && placed[next].at <= idx) html += imgTag(placed[next++].img, alt);
        html += paras(p);
      });
      while (next < placed.length) html += imgTag(placed[next++].img, alt);
      parts.push(
        `<hr style="border:none;border-top:1px solid #e6e6e6;margin:34px 0" />
         <h2 style="font-size:22px;margin:0 0 14px;color:#111">${esc(c.title || `Chapter ${i + 1}`)}</h2>
         ${html}`,
      );
    });

    const html = `<!doctype html><html><body style="margin:0;background:#ffffff">
      <div style="max-width:640px;margin:0 auto;padding:28px 22px;font-family:Georgia,'Times New Roman',serif;background:#ffffff">
        ${parts.join("")}
        <p style="margin:36px 0 0;font-size:11px;color:#999;text-align:center">The complete story is contained in this email.</p>
      </div></body></html>`;

    // Resend's hard payload ceiling is ~40MB; keep well clear of it.
    if (html.length > 8 * 1024 * 1024) {
      return json({ error: "This story is too large to email in one message. Send it as an EPUB instead." }, 400);
    }

    const attachments =
      body.attachment?.contentBase64 && body.attachment.contentBase64.length > 100
        ? [{
            filename: String(body.attachment.filename ?? "story.epub").replace(/[^\w.\-]+/g, "-").slice(0, 120),
            content: body.attachment.contentBase64,
          }]
        : undefined;

    const send = async (from: string) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: recipients,
          reply_to: userData.user.email ?? undefined,
          subject: `${title}${author ? ` — by ${author}` : ""}`,
          html,
          attachments,
        }),
      });
      const out = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, out };
    };

    let result = await send(PRIMARY_FROM);
    if (!result.ok && PRIMARY_FROM !== FALLBACK_FROM) result = await send(FALLBACK_FROM);

    if (!result.ok) {
      console.error(`Resend failed [${result.status}]:`, JSON.stringify(result.out));
      return json({ error: (result.out as any)?.message ?? "Email delivery failed.", status: result.status }, 502);
    }

    return json({ sent: true, to: recipients[0] });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "Unexpected error" }, 500);
  }
});
