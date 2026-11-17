// Serves the Android app file with the right labels so phones save it as an
// installable .apk (storage labels it as a generic file, which some phones
// save as ".bin" or refuse to open). Public — visitors install before signing up.
const APK_URL = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/app-downloads/oracle-lunar.apk`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "range, content-type",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges, content-disposition",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: cors });

  const range = req.headers.get("range");
  const upstream = await fetch(APK_URL, {
    method: req.method,
    headers: range && /^bytes=\d*-\d*$/.test(range) ? { range } : {},
  });
  if (!upstream.ok && upstream.status !== 206) {
    return new Response("The app file isn't available right now.", { status: 503, headers: cors });
  }
  const headers = new Headers(cors);
  headers.set("Content-Type", "application/vnd.android.package-archive");
  headers.set("Content-Disposition", 'attachment; filename="oracle-lunar.apk"');
  headers.set("Cache-Control", "no-cache");
  headers.set("Accept-Ranges", "bytes");
  for (const h of ["content-length", "content-range", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(req.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
});
