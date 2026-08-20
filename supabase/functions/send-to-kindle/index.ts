// Emails a finished EPUB straight to a reader's @kindle.com address using
// Amazon's "Send to Kindle" personal-document email service.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PRIMARY_FROM = Deno.env.get("KINDLE_FROM_EMAIL") || "Oracle Lunar Books <kindle@oracle-lunar.online>";
const FALLBACK_FROM = "Oracle Lunar Books <onboarding@resend.dev>";

const senderAddress = (from: string) => from.match(/<([^>]+)>/)?.[1] ?? from;

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

    // ---- auth ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in to send to Kindle." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Sign in to send to Kindle." }, 401);

    // ---- input validation ----
    const body = await req.json().catch(() => null) as
      | { kindleEmail?: string; filename?: string; title?: string; fileBase64?: string }
      | null;
    if (!body) return json({ error: "Invalid request body." }, 400);

    const kindleEmail = String(body.kindleEmail ?? "").trim().toLowerCase();
    const title = String(body.title ?? "Untitled Story").slice(0, 200);
    const filename = String(body.filename ?? "story.epub").slice(0, 120).replace(/[^\w.\-]+/g, "-");
    const fileBase64 = String(body.fileBase64 ?? "");

    if (!/^[^\s@]+@(kindle\.com|free\.kindle\.com)$/.test(kindleEmail)) {
      return json({ error: "That doesn't look like a Kindle address. It must end in @kindle.com." }, 400);
    }
    if (!filename.toLowerCase().endsWith(".epub")) {
      return json({ error: "Only EPUB files can be sent to Kindle." }, 400);
    }
    if (fileBase64.length < 100) return json({ error: "The book file was empty." }, 400);
    // Amazon rejects personal documents over 50MB; base64 is ~1.37x raw size.
    if (fileBase64.length > 50 * 1024 * 1024 * 1.4) {
      return json({ error: "This book is over Amazon's 50MB personal-document limit." }, 400);
    }

    const send = async (from: string) => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [kindleEmail],
          // Amazon uses the subject as the document title hint.
          subject: title,
          text: `${title} — delivered by Oracle Lunar.`,
          attachments: [{ filename, content: fileBase64 }],
        }),
      });
      const out = await res.json().catch(() => ({}));
      return { ok: res.ok, out };
    };

    let usedFrom = PRIMARY_FROM;
    let result = await send(PRIMARY_FROM);
    if (!result.ok && PRIMARY_FROM !== FALLBACK_FROM) {
      usedFrom = FALLBACK_FROM;
      result = await send(FALLBACK_FROM);
    }

    if (!result.ok) {
      const msg = (result.out as any)?.message ?? "Amazon delivery failed.";
      return json({ error: msg }, 502);
    }

    return json({
      sent: true,
      sender: senderAddress(usedFrom),
      kindleEmail,
      message: `Sent to ${kindleEmail}. It appears on your Kindle in a few minutes.`,
    });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "Unexpected error" }, 500);
  }
});
