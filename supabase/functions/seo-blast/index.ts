// Oracle Lunar — SEO Blast edge function
// Pings Google + Bing sitemaps and submits ALL URLs to IndexNow
// (instant indexing for Bing, Yandex, Naver, Seznam, Yep).
// Safe to call repeatedly — idempotent. Designed for cron + manual trigger.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SITE = "https://oracle-lunar.online";
const SITEMAP_URL = `${SITE}/sitemap.xml`;
const INDEXNOW_KEY = "40c21cdfe37d596683032a1dcc3b5563";
const INDEXNOW_KEY_LOCATION = `${SITE}/${INDEXNOW_KEY}.txt`;

async function fetchSitemapUrls(): Promise<string[]> {
  const res = await fetch(SITEMAP_URL, { headers: { "User-Agent": "OracleLunar-SEOBlast/1.0" } });
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)];
  return matches.map((m) => m[1].trim()).filter(Boolean);
}

async function pingSearchEngine(name: string, url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "OracleLunar-SEOBlast/1.0" } });
    return { engine: name, status: res.status, ok: res.ok };
  } catch (e) {
    return { engine: name, status: 0, ok: false, error: String(e) };
  }
}

async function submitIndexNow(urls: string[]) {
  // IndexNow accepts up to 10,000 URLs per submission across Bing, Yandex, etc.
  const body = {
    host: "oracle-lunar.online",
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: urls,
  };
  const endpoints = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
    "https://yandex.com/indexnow",
  ];
  const results = await Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(body),
        });
        return { endpoint, status: res.status, ok: res.status >= 200 && res.status < 300 };
      } catch (e) {
        return { endpoint, status: 0, ok: false, error: String(e) };
      }
    }),
  );
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const urls = await fetchSitemapUrls();

    const [google, bing, indexNow] = await Promise.all([
      pingSearchEngine("google", `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`),
      pingSearchEngine("bing", `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`),
      submitIndexNow(urls),
    ]);

    const summary = {
      ok: true,
      site: SITE,
      timestamp: new Date().toISOString(),
      urls_submitted: urls.length,
      sitemap_pings: [google, bing],
      indexnow_results: indexNow,
      note: "Submitted to Google + Bing sitemaps and IndexNow (Bing/Yandex/IndexNow API). Indexing is decided by each search engine.",
    };

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});