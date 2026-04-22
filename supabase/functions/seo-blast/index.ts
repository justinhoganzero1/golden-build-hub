// Oracle Lunar — SEO Blast edge function
// Submits all sitemap URLs to the IndexNow network (Bing, Yandex, Seznam, Naver, Yep).
// NOTE: Google deprecated /ping?sitemap and Bing did the same in 2024 — both now
// return 404/410. The only reliable external push channel left is IndexNow plus
// user-verified Google Search Console (which the site owner must connect manually).

const SITE = "https://oracle-lunar.online";
const SITEMAP_URL = `${SITE}/sitemap.xml`;
const INDEXNOW_KEY = "40c21cdfe37d596683032a1dcc3b5563";
const INDEXNOW_KEY_LOCATION = `${SITE}/${INDEXNOW_KEY}.txt`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchSitemapUrls(): Promise<string[]> {
  const res = await fetch(SITEMAP_URL, { headers: { "User-Agent": "OracleLunar-SEOBlast/1.0" } });
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)];
  return matches.map((m) => m[1].trim()).filter(Boolean);
}

async function submitIndexNow(urls: string[]) {
  const body = {
    host: "oracle-lunar.online",
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: urls,
  };
  const endpoints = [
    "https://yandex.com/indexnow",
    "https://www.bing.com/indexnow",
    "https://api.indexnow.org/indexnow",
    "https://search.seznam.cz/indexnow",
    "https://indexnow.naver.com/indexnow",
  ];
  return await Promise.all(
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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const urls = await fetchSitemapUrls();
    const indexNow = await submitIndexNow(urls);
    const successCount = indexNow.filter((r) => r.ok).length;

    const summary = {
      ok: true,
      site: SITE,
      timestamp: new Date().toISOString(),
      urls_submitted: urls.length,
      indexnow_endpoints_accepted: successCount,
      indexnow_results: indexNow,
      note: "Submitted to IndexNow network (Bing/Yandex/Seznam/Naver). Google requires Search Console verification — see index.html.",
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
