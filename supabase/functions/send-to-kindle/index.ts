// Emails a finished EPUB straight to a reader's @kindle.com address using
// Amazon's "Send to Kindle" personal-document email service.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const KINDLE_SENDER = "kindle@kindle.oracle-lunar.online";
const KINDLE_DOMAIN = "kindle.oracle-lunar.online";
const BASE64_LIMIT = 15 * 1024 * 1024;

/** Ask Resend which of our domains are actually verified, and build the From. */
const resolveSender = async (apiKey: string) => {
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const out = await res.json().catch(() => ({}));
    const list: any[] = Array.isArray(out?.data) ? out.data : [];
    const verified = list.filter((d) => String(d?.status).toLowerCase() === "verified").map((d) => String(d.name));
    return {
      ready: verified.includes(KINDLE_DOMAIN),
      verified,
      all: list.map((d) => ({ name: String(d?.name), status: String(d?.status) })),
    };
  } catch (error) {
    console.error("send-to-kindle domain check failed", (error as Error)?.message);
    return { ready: false, verified: [] as string[], all: [] as { name: string; status: string }[] };
  }
};

const mapProviderStatus = (event: string) => {
  if (["delivered", "opened", "clicked"].includes(event)) return "delivered_to_mail_server";
  if (["delivery_delayed", "delayed"].includes(event)) return "delayed";
  if (["bounced", "complained"].includes(event)) return "bounced";
  if (["failed", "cancelled"].includes(event)) return "failed";
  return "queued";
};


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
    const user = await userRes.json().catch(() => null) as { id?: string } | null;
    if (!user?.id) return json({ error: "Sign in to send to Kindle." }, 401);

    // ---- input validation ----
    const body = await req.json().catch(() => null) as
      | { kindleEmail?: string; filename?: string; title?: string; fileBase64?: string; probe?: boolean; deliveryId?: string }
      | null;
    if (!body) return json({ error: "Invalid request body." }, 400);

    const senderInfo = await resolveSender(RESEND_API_KEY);

    // Probe mode: the dialog asks which sender address to show the reader.
    if (body.probe) {
      return json({
        ready: senderInfo.ready,
        sender: KINDLE_SENDER,
        domains: senderInfo.all,
      });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const databaseUrl = `${Deno.env.get("SUPABASE_URL")}/rest/v1/kindle_deliveries`;
    const serviceHeaders = {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    };

    if (body.deliveryId) {
      const deliveryId = String(body.deliveryId);
      if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) return json({ error: "Invalid delivery reference." }, 400);
      const rowRes = await fetch(`${databaseUrl}?id=eq.${deliveryId}&user_id=eq.${user.id}&select=*`, { headers: serviceHeaders });
      const rows = await rowRes.json().catch(() => []);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return json({ error: "Delivery record not found." }, 404);
      if (row.provider_message_id && !["bounced", "failed"].includes(row.status)) {
        const providerRes = await fetch(`https://api.resend.com/emails/${encodeURIComponent(row.provider_message_id)}`, {
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });
        const provider = await providerRes.json().catch(() => ({}));
        if (providerRes.ok) {
          const status = mapProviderStatus(String(provider.last_event ?? ""));
          if (status !== row.status) {
            await fetch(`${databaseUrl}?id=eq.${deliveryId}`, {
              method: "PATCH",
              headers: serviceHeaders,
              body: JSON.stringify({ status, failure_reason: status === "bounced" ? "Amazon rejected the email." : null }),
            });
            row.status = status;
          }
        }
      }
      return json({ deliveryId: row.id, status: row.status, sender: row.sender_email, kindleEmail: row.kindle_email, failureReason: row.failure_reason });
    }


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
    if (!fileBase64.startsWith("UEsDB") || !/^[A-Za-z0-9+/=]+$/.test(fileBase64)) {
      return json({ error: "The EPUB is damaged or incomplete. Rebuild the book and try again." }, 400);
    }
    // Hard cap well under Amazon's 50MB: the edge worker holds several copies of
    // the payload while serialising it for Resend, so bigger books kill it.
    // 15MB of base64 is roughly an 11MB EPUB.
    if (fileBase64.length > BASE64_LIMIT) {
      return json({
        error:
          "This book is too large to email to Kindle (over ~11MB). Use Download EPUB and drop the file into the Kindle app — the cover and illustrations are all inside.",
      }, 413);
    }

    const send = async (from: string) => {
      try {
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
            attachments: [{
              filename,
              content: fileBase64,
              content_type: "application/epub+zip",
            }],
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) console.error("send-to-kindle resend error", res.status, JSON.stringify(out).slice(0, 300));
        return { ok: res.ok, out };
      } catch (err) {
        console.error("send-to-kindle send failed", (err as Error)?.message);
        return { ok: false, out: { message: "Could not reach the email service." } };
      }
    };

    if (!senderInfo.ready) {
      const names = senderInfo.all.map((d) => `${d.name} (${d.status})`).join(", ") || "none added";
      console.error("send-to-kindle: fixed sending domain is not verified", names);
      return json({
        error:
          "Kindle delivery can't send yet — no verified sending address is available. Use Download EPUB and drop it into the Kindle app; the cover and illustrations are all inside.",
        detail: `Resend domains: ${names}`,
      }, 502);
    }

    const usedFrom = `Oracle Lunar Books <${KINDLE_SENDER}>`;
    const result = await send(usedFrom);

    if (!result.ok) {
      const raw = String((result.out as any)?.message ?? "Amazon delivery failed.");
      const notVerified =
        /not verified|verify a domain|only send testing emails|own email address/i.test(raw);
      const msg = notVerified
          ? `Kindle delivery isn't switched on yet: our sending address (${KINDLE_SENDER}) still needs to be verified for email. Until then, use Download EPUB and upload it through Send to Kindle — your cover and illustrations are all inside.`
        : raw;
      return json({ error: msg, detail: raw }, 502);
    }

    const providerMessageId = String((result.out as any)?.id ?? "");
    if (!providerMessageId) return json({ error: "The email service did not return a tracking reference. Nothing was marked delivered." }, 502);
    const fileSizeBytes = Math.floor(fileBase64.length * 0.75);
    const recordRes = await fetch(databaseUrl, {
      method: "POST",
      headers: { ...serviceHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: user.id,
        title,
        filename,
        kindle_email: kindleEmail,
        sender_email: KINDLE_SENDER,
        file_size_bytes: fileSizeBytes,
        provider_message_id: providerMessageId,
        status: "queued",
      }),
    });
    const records = await recordRes.json().catch(() => []);
    const deliveryId = Array.isArray(records) ? records[0]?.id : null;
    if (!recordRes.ok || !deliveryId) {
      console.error("send-to-kindle tracking insert failed", recordRes.status, providerMessageId);
      return json({ error: "The book email was queued, but tracking could not be created. Please do not resend yet." }, 502);
    }
    console.log(JSON.stringify({ event: "kindle_queued", deliveryId, providerMessageId, userId: user.id, sender: KINDLE_SENDER, kindleEmail, filename, fileSizeBytes }));

    return json({
      queued: true,
      deliveryId,
      status: "queued",
      providerMessageId,
      sender: KINDLE_SENDER,
      kindleEmail,
      message: `Queued for ${kindleEmail}. This does not yet confirm Amazon accepted the book.`,
    });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "Unexpected error" }, 500);
  }
});
