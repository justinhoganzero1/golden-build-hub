// YouTube publish helper.
// MODE A (works today, zero setup): action="bundle" -> returns { ready: true } and lets the
//   client build a downloadable bundle (the MP4 + metadata.txt).
// MODE B (one-click upload): action="upload" -> requires the user to have connected their
//   YouTube channel via OAuth (Google Cloud Console client). If no token in body, returns
//   { needs_oauth: true, oauth_url } so the UI can prompt them.
//
// To enable MODE B for production, the project owner must:
//  1. Create OAuth credentials in Google Cloud Console with scope https://www.googleapis.com/auth/youtube.upload
//  2. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET as Lovable Cloud secrets
//  3. Whitelist the redirect URI: <site>/youtube-oauth-callback

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body.action as "bundle" | "upload" | "oauth_start" | "oauth_exchange";

    if (action === "bundle") {
      // Just confirm the package is well-formed; the actual file packaging happens client-side
      const { title, description, tags, video_url } = body;
      if (!title || !video_url) return json({ error: "title and video_url required" }, 400);
      return json({
        ready: true,
        instructions: [
          "1. Download the MP4 below.",
          "2. Go to https://studio.youtube.com → Create → Upload videos.",
          "3. Drag the MP4 in.",
          "4. Paste the title, description, and tags from the metadata file.",
          "5. Upload the thumbnail image.",
          "6. Hit Publish.",
        ],
        metadata_text: buildMetadataText({ title, description, tags }),
      });
    }

    if (action === "oauth_start") {
      const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
      if (!clientId) {
        return json({
          needs_setup: true,
          message: "One-click YouTube upload requires the project owner to connect a Google Cloud OAuth client. Use the download bundle instead.",
        });
      }
      const redirect = body.redirect_uri;
      const url = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirect,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
        access_type: "offline",
        prompt: "consent",
      });
      return json({ oauth_url: url });
    }

    if (action === "oauth_exchange") {
      const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
      if (!clientId || !clientSecret) return json({ error: "Owner has not configured Google OAuth secrets" }, 400);
      const { code, redirect_uri } = body;
      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });
      const tj = await tokenResp.json();
      return json(tj);
    }

    if (action === "upload") {
      const { access_token, video_url, title, description, tags, privacy = "private" } = body;
      if (!access_token) return json({ needs_oauth: true });
      if (!video_url) return json({ error: "video_url required" }, 400);

      // Fetch the video bytes from the storage URL
      const vidResp = await fetch(video_url);
      if (!vidResp.ok) throw new Error(`Could not fetch video (${vidResp.status})`);
      const videoBytes = new Uint8Array(await vidResp.arrayBuffer());

      // YouTube resumable upload — start
      const metadata = {
        snippet: { title, description, tags, categoryId: "22" },
        status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
      };
      const startResp = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": "video/mp4",
            "X-Upload-Content-Length": String(videoBytes.length),
          },
          body: JSON.stringify(metadata),
        }
      );
      if (!startResp.ok) {
        const t = await startResp.text();
        return json({ error: `YouTube init failed: ${t}` }, 502);
      }
      const uploadUrl = startResp.headers.get("Location");
      if (!uploadUrl) return json({ error: "No upload URL from YouTube" }, 502);

      const putResp = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4", "Content-Length": String(videoBytes.length) },
        body: videoBytes,
      });
      if (!putResp.ok) {
        const t = await putResp.text();
        return json({ error: `YouTube upload failed: ${t}` }, 502);
      }
      const result = await putResp.json();
      return json({ video_id: result.id, watch_url: `https://youtu.be/${result.id}` });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("youtube-publish error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function buildMetadataText({ title, description, tags }: { title: string; description: string; tags?: string[] }) {
  return [
    `TITLE:`,
    title,
    ``,
    `DESCRIPTION:`,
    description,
    ``,
    `TAGS:`,
    (tags || []).join(", "),
  ].join("\n");
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
