import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { templateAccess, templateMetadata, templateObjectPath } from "../_shared/templateAccess.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const STORAGE_RE = /\/storage\/v1\/object\/(?:(public|sign|authenticated)\/)?([^/?#]+)\/([^?#]+)/;

// Copies a member's shared creation into the caller's own Library so they can
// build on it. Paid templates require a completed Creators Shop purchase.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Please sign in." }, 401);
    const { data: u } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    const user = u.user;
    if (!user) return json({ error: "Please sign in." }, 401);

    const { item_id } = await req.json().catch(() => ({}));
    if (typeof item_id !== "string" || item_id.length < 10) return json({ error: "Invalid item" }, 400);

    const { data: src } = await admin
      .from("user_media")
      .select("id,user_id,media_type,title,url,thumbnail_url,source_page,metadata,is_public,allow_template,shop_enabled,shop_price_cents,creator_display_name,download_count")
      .eq("id", item_id)
      .maybeSingle();
    if (!src) return json({ error: "This creation is no longer shared." }, 404);

    // Already copied? Hand back the existing copy instead of making another.
    const { data: existing } = await admin
      .from("user_media")
      .select("id,title")
      .eq("user_id", user.id)
      .eq("metadata->>template_of", src.id)
      .limit(1)
      .maybeSingle();
    if (existing) return json({ id: existing.id, title: existing.title, existing: true });

    const [{ data: member }, { data: purchase }] = await Promise.all([
      admin.rpc("is_active_member", { _user_id: user.id }),
      admin
        .from("shop_purchases")
        .select("id")
        .eq("buyer_id", user.id)
        .eq("item_kind", "media")
        .eq("item_id", src.id)
        .eq("status", "paid")
        .limit(1)
        .maybeSingle(),
    ]);

    const decision = templateAccess(src as any, user.id, { member: !!member, purchased: !!purchase });
    if (decision === "not-shared") return json({ error: "The creator hasn't shared this as a template." }, 403);
    if (decision === "own-item") return json({ error: "This is already yours." }, 400);
    if (decision === "not-member") return json({ error: "Templates are for members.", needs_membership: true }, 403);
    if (decision === "needs-purchase") return json({ error: "Buy this template first.", needs_purchase: true }, 402);

    const newId = crypto.randomUUID();
    const copyFile = async (fileUrl: string | null): Promise<string | null> => {
      if (!fileUrl) return fileUrl;
      const m = fileUrl.match(STORAGE_RE);
      if (!m) return fileUrl; // site asset, external link or inline content
      const kind = m[1];
      const bucket = decodeURIComponent(m[2]);
      const path = decodeURIComponent(m[3]);
      const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(path);
      if (dlErr || !blob) throw new Error("Could not copy the creator's file.");
      const newPath = templateObjectPath(user.id, newId, path);
      const { error: upErr } = await admin.storage.from(bucket).upload(newPath, blob, {
        contentType: blob.type || undefined,
        upsert: false,
      });
      if (upErr) throw new Error("Could not save your copy.");
      const encoded = newPath.split("/").map(encodeURIComponent).join("/");
      return kind === "public"
        ? `${url}/storage/v1/object/public/${bucket}/${encoded}`
        : `${url}/storage/v1/object/authenticated/${bucket}/${encoded}`;
    };

    const isText = src.media_type === "text";
    const newUrl = isText ? src.url : await copyFile(src.url);
    const newThumb = await copyFile(src.thumbnail_url);

    const title = `${src.title || "Creation"} (template)`.slice(0, 200);
    const { error: insErr } = await admin.from("user_media").insert({
      id: newId,
      user_id: user.id,
      media_type: src.media_type,
      title,
      url: newUrl,
      thumbnail_url: newThumb,
      source_page: src.source_page,
      metadata: templateMetadata(src.metadata, src.id, src.creator_display_name),
      is_public: false,
      allow_template: false,
      shop_enabled: false,
      shop_price_cents: 0,
    });
    if (insErr) throw insErr;

    await admin
      .from("user_media")
      .update({ download_count: ((src as any).download_count || 0) + 1 })
      .eq("id", src.id)
      .then(() => undefined, () => undefined);

    return json({ id: newId, title });
  } catch (e) {
    console.error("[library-use-template]", e);
    return json({ error: e instanceof Error ? e.message : "Something went wrong." }, 500);
  }
});
