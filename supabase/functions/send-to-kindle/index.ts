// Emails a finished EPUB straight to a reader's @kindle.com address using
// Amazon's "Send to Kindle" personal-document email service.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    // Lightweight auth check over REST — importing the full client alongside a
    // multi-megabyte attachment pushes the worker past its memory limit.
    const userRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      },
    });
    if (!userRes.ok) {
      await userRes.body?.cancel();
      return json({ error: "Sign in to send to Kindle." }, 401);
    }
    await userRes.json().catch(() => null);

    // ---- input validation ----
    const body = await req.json().catch(() => null) as
      | { kindleEmail?: string; filename?: string; title?: string; fileBase64?: string }
      | null;
    if (!body) return json({ error: "Invalid request body." }, 400);

    const kindleEmail = String(body.kindleEmail ?? "").trim().toLowerCase();
    const title = String(body.title ?? "Untitled Story").slice(0, 200);
    const filename = String(body.filename ?? "story.epub").slice(0, 120).replace(/[^\w.\-]+/g, "-");
    // Reference the string directly — copying a multi-MB base64 payload is what
    // tips the worker over its memory limit.
    const fileBase64 = typeof body.fileBase64 === "string" ? body.fileBase64 : "";
    body.fileBase64 = undefined;


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
      const raw = String((result.out as any)?.message ?? "Amazon delivery failed.");
      const notVerified =
        /not verified|verify a domain|only send testing emails|own email address/i.test(raw);
      const msg = notVerified
        ? "Kindle delivery isn't switched on yet: our sending address (oracle-lunar.online) still needs to be verified for email. Until then, use Download EPUB and drop it into the Kindle app — your cover and illustrations are all inside."
        : raw;
      return json({ error: msg, detail: raw }, 502);
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
