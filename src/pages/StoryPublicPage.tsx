import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import SEO from "@/components/SEO";
import ShareDialog from "@/components/ShareDialog";
import { Share2, BookOpen, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildStoryFile, downloadFile, STORY_FILE_META, type StoryFileFormat } from "@/lib/storyFiles";

interface Chapter { title: string; content: string; images?: string[] }
interface StoryMeta {
  title: string;
  genre: string;
  premise: string;
  chapters: Chapter[];
  authorName?: string;
  coverImage?: string;
}

const StoryPublicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [story, setStory] = useState<StoryMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [dlBusy, setDlBusy] = useState<StoryFileFormat | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) return;
      const { data } = await (supabase as any)
        .from("public_stories")
        .select("title, genre, premise, chapters, author_name, cover_image")
        .eq("slug", slug)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setStory({
          title: data.title,
          genre: data.genre || "",
          premise: data.premise || "",
          chapters: Array.isArray(data.chapters) ? (data.chapters as any[]) : [],
          authorName: data.author_name || undefined,
          coverImage: data.cover_image || undefined,
        });
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const download = async (format: StoryFileFormat) => {
    if (!story || dlBusy) return;
    setDlBusy(format);
    try {
      const file = await buildStoryFile(
        {
          title: story.title,
          author: story.authorName,
          genre: story.genre,
          premise: story.premise,
          coverImage: story.coverImage,
          chapters: story.chapters,
        },
        format,
      );
      downloadFile(file);
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally {
      setDlBusy(null);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="text-center">
          <BookOpen className="w-10 h-10 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Story not found</h1>
          <p className="text-sm text-muted-foreground mt-2">This story may have been unpublished.</p>
        </div>
      </div>
    );
  }

  const url = `https://oracle-lunar.online/stories/${slug}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title={`${story.title} — Oracle Lunar Stories`}
        description={story.premise.slice(0, 150) || `Read "${story.title}" on Oracle Lunar.`}
      />
      <div className="max-w-3xl mx-auto px-5 py-12">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-primary mb-2">{story.genre}</p>
            <h1 className="text-4xl font-bold leading-tight">{story.title}</h1>
            {story.authorName && (
              <p className="text-sm text-muted-foreground mt-2">by {story.authorName}</p>
            )}
          </div>
          <button
            onClick={() => setShareOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
        {story.coverImage && (
          <img
            src={story.coverImage}
            alt={`${story.title} cover art`}
            className="w-full rounded-xl border border-border mb-8"
            loading="lazy"
          />
        )}
        {story.premise && (
          <p className="text-base text-muted-foreground italic border-l-2 border-primary/40 pl-4 mb-6">
            {story.premise}
          </p>
        )}
        <div className="flex flex-wrap gap-2 mb-8">
          {(Object.keys(STORY_FILE_META) as StoryFileFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => download(f)}
              disabled={!!dlBusy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              {dlBusy === f ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {STORY_FILE_META[f].label}
            </button>
          ))}
        </div>

        <div className="space-y-10">
          {story.chapters.map((c, i) => (
            <article key={i} className="prose prose-invert max-w-none">
              <h2 className="text-2xl font-semibold border-b border-border pb-2 mb-4">{c.title}</h2>
              <ReactMarkdown>{c.content}</ReactMarkdown>
            </article>
          ))}
        </div>

        <div className="mt-16 p-5 rounded-xl border border-border text-center">
          <p className="text-sm text-muted-foreground mb-3">Created with Oracle Lunar</p>
          <a
            href="https://oracle-lunar.online"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-semibold"
          >
            Try Oracle Lunar free
          </a>
        </div>
      </div>
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={story.title}
        url={url}
        description={story.premise || `Read "${story.title}" on Oracle Lunar.`}
      />
    </div>
  );
};

export default StoryPublicPage;
