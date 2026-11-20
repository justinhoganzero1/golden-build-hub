// Public Oracle News pages on oraclelunar.com: only stories the owner chose to publish.
// Original AI-written summaries with source links and licensed visuals, readable without signing in.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Download, Newspaper } from "lucide-react";
import SEO from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CreditBanner, clipPlayerUrl } from "@/components/news/CreditBanner";
import { VERIFICATION_LABEL, type Verification } from "../../supabase/functions/_shared/newsLogic";

type Row = Record<string, any>;
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "");

const NewsPublicPage = () => {
  const { id } = useParams();
  const [stories, setStories] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStories(null); setError(null);
    supabase.functions.invoke("news-controller", { body: { action: "public_news", ...(id ? { id } : {}) } })
      .then(({ data, error: e }) => { if (e) setError("The news couldn't be loaded right now."); else setStories(data?.stories ?? []); })
      .catch(() => setError("The news couldn't be loaded right now."));
  }, [id]);

  const story = id ? stories?.[0] : null;
  const sections: Row[] = story?.sections ?? [];
  const description = story ? (sections.find((s) => s.key === "what_happened")?.text ?? story.headline).slice(0, 155) : "Oracle News: original, source-linked news summaries written by Oracle, the AI presenter of Oracle Lunar.";

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO
        title={story ? story.headline : "Oracle News — AI news summaries with sources"}
        description={description}
        path={id ? `/news/${id}` : "/news"}
        type={story ? "article" : "website"}
        jsonLd={story ? {
          "@context": "https://schema.org", "@type": "NewsArticle", headline: story.headline, datePublished: story.published_at, dateModified: story.updated_at,
          author: { "@type": "Organization", name: "Oracle News (AI-written)", url: "https://oraclelunar.com/news" },
          publisher: { "@type": "Organization", name: "Oracle Lunar", logo: { "@type": "ImageObject", url: "https://oraclelunar.com/icons/icon-512.png" } },
          isBasedOn: (story.sources ?? []).map((s: Row) => s.url), mainEntityOfPage: `https://oraclelunar.com/news/${story.id}`,
        } : { "@context": "https://schema.org", "@type": "CollectionPage", name: "Oracle News", url: "https://oraclelunar.com/news" }}
      />
      <div className="max-w-3xl mx-auto px-4 pt-8 space-y-5">
        <header className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10"><Newspaper className="w-7 h-7 text-primary" /></div>
          <div>
            <p className="text-xl font-bold text-primary">Oracle News</p>
            <p className="text-xs text-muted-foreground">Written by Oracle, the AI presenter of Oracle Lunar, from the news reports linked on each story.</p>
          </div>
        </header>

        {id && <Link to="/news" className="inline-flex items-center gap-1 text-sm text-primary"><ArrowLeft className="w-4 h-4" /> All stories</Link>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!stories && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
        {stories && !stories.length && <p className="text-sm text-muted-foreground">{id ? "This story isn't available." : "No stories published yet — check back soon."}</p>}

        {!id && stories?.map((s) => (
          <Link key={s.id} to={`/news/${s.id}`} className="block">
            <Card className="p-4 space-y-1 hover:border-primary/60 transition-colors">
              <div className="flex flex-wrap gap-2 items-center text-[11px] text-muted-foreground">
                <Badge variant="secondary">{s.category ?? "news"}</Badge><span>{day(s.published_at)}</span>
              </div>
              <h2 className="text-base font-semibold">{s.headline}</h2>
              {s.teaser && <p className="text-sm text-muted-foreground">{s.teaser}</p>}
            </Card>
          </Link>
        ))}

        {story && (
          <article className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 items-center text-[11px] text-muted-foreground">
                <Badge variant="secondary">{story.category ?? "news"}</Badge>
                <span>{day(story.published_at)}</span>
                <span>· {VERIFICATION_LABEL[story.verification as Verification] ?? story.verification}</span>
              </div>
              <h1 className="text-2xl font-bold leading-tight">{story.headline}</h1>
            </div>
            {(story.visuals ?? [])[0] && (() => {
              const v = [...story.visuals].sort((a: Row, b: Row) => Number(!!b.embed_url) - Number(!!a.embed_url))[0];
              if (v.embed_url) return (
                <figure className="space-y-1">
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-secondary">
                    <iframe src={clipPlayerUrl(v.embed_url)} title={`News clip from ${v.attribution}`} className="absolute inset-0 w-full h-full" allow="encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy" />
                  </div>
                  <CreditBanner credit={v.attribution ?? "YouTube"} className="rounded-md overflow-hidden" />
                  <figcaption className="text-[10px] text-muted-foreground">Thanks to {v.attribution} for this clip · <a href={v.url} target="_blank" rel="noreferrer" className="underline">watch on YouTube</a></figcaption>
                </figure>
              );
              return (
                <figure className="space-y-1">
                  {v.media_type === "image" ? <img src={v.media_url} alt={v.title} className="w-full rounded-xl aspect-video object-cover" loading="lazy" /> : <video src={v.media_url} controls muted playsInline preload="metadata" className="w-full rounded-xl aspect-video" />}
                  <figcaption className="text-[10px] text-muted-foreground">{v.attribution} · <a href={v.url} target="_blank" rel="noreferrer" className="underline">source</a></figcaption>
                </figure>
              );
            })()}
            {sections.filter((s) => s.key !== "closing").map((s) => (
              <section key={s.key} className="space-y-1">
                {s.key !== "intro" && <h2 className="text-sm font-semibold text-primary">{s.label}</h2>}
                <p className="text-sm leading-relaxed">{s.text}</p>
              </section>
            ))}
            <Card className="p-3 space-y-1">
              <p className="text-xs font-semibold">Sources</p>
              {(story.sources ?? []).map((s: Row) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="flex items-start gap-1 text-xs text-primary"><ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />{s.publisher}: {s.title}</a>
              ))}
              <p className="text-[10px] text-muted-foreground pt-1">This summary was written by AI from the reports above. Check the original reporting for full detail.</p>
            </Card>
          </article>
        )}

        <Card className="p-4 flex flex-wrap items-center gap-3">
          <p className="text-sm flex-1 min-w-[12rem]">Hear Oracle read the news, chat by voice and create with AI in the Oracle Lunar app.</p>
          <Button asChild><Link to="/download"><Download className="w-4 h-4 mr-1" /> Get the app</Link></Button>
        </Card>
      </div>
    </div>
  );
};

export default NewsPublicPage;
