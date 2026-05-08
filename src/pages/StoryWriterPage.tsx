import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen, Sparkles, Save, Wand2, Plus, Trash2, Download,
  Share2, FileText, Loader2, ChevronLeft, Crown, Lock,
} from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import ShareDialog from "@/components/ShareDialog";
import PaywallGate, { hasAccess } from "@/components/PaywallGate";
import { useSubscription } from "@/hooks/useSubscription";
import ReactMarkdown from "react-markdown";
import { saveToLibrary } from "@/lib/saveToLibrary";
import StoragePanel from "@/components/StoragePanel";

interface StoryChapter {
  title: string;
  content: string;
}
interface StoryDoc {
  id?: string;
  title: string;
  genre: string;
  premise: string;
  chapters: StoryChapter[];
  published?: boolean;
  publishedUrl?: string;
}

const GENRES = [
  "Fantasy", "Sci-Fi", "Mystery", "Romance", "Thriller",
  "Horror", "Adventure", "Drama", "Comedy", "Children's",
  "Memoir", "Historical", "Poetry", "Non-fiction",
];

const TOOLS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`;

const StoryWriterPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const { tier } = useSubscription();
  const isAdmin = user?.email === "justinbretthogan@gmail.com";
  const canPublish = isAdmin || hasAccess(tier, "monthly");

  const [story, setStory] = useState<StoryDoc>({
    title: params.get("title") || "Untitled Story",
    genre: "Fantasy",
    premise: params.get("prompt") || "",
    chapters: [{ title: "Chapter 1", content: "" }],
  });
  const [activeChapter, setActiveChapter] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [chapterGuidance, setChapterGuidance] = useState("");
  // Workflow stage after a chapter is generated:
  // 'idle' = ready to generate; 'askEdit' = chapter done, ask to edit;
  // 'editing' = collecting edit instructions; 'askNext' = ask for next chapter guidance.
  const [flowStage, setFlowStage] = useState<"idle" | "askEdit" | "editing" | "askNext">("idle");
  const [editInstructions, setEditInstructions] = useState("");
  const [nextGuidance, setNextGuidance] = useState("");

  // === Autosave AI inputs to localStorage (per story + chapter) ===
  const draftKey = useMemo(
    () => `story-writer-drafts:${savingId || "new"}:${activeChapter}`,
    [savingId, activeChapter]
  );

  // Load drafts when story/chapter changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        setChapterGuidance(d.chapterGuidance || "");
        setEditInstructions(d.editInstructions || "");
        setNextGuidance(d.nextGuidance || "");
      } else {
        setChapterGuidance("");
        setEditInstructions("");
        setNextGuidance("");
      }
    } catch { /* ignore */ }
  }, [draftKey]);

  // Persist drafts (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (chapterGuidance || editInstructions || nextGuidance) {
          localStorage.setItem(
            draftKey,
            JSON.stringify({ chapterGuidance, editInstructions, nextGuidance })
          );
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(t);
  }, [draftKey, chapterGuidance, editInstructions, nextGuidance]);

  // Load saved stories from library
  const { data: savedStories = [] } = useQuery({
    queryKey: ["story-writer-library", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_media")
        .select("*")
        .eq("user_id", user!.id)
        .eq("source_page", "story-writer")
        .eq("media_type", "story")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-load story by id from URL
  useEffect(() => {
    const id = params.get("id");
    if (!id || !user) return;
    (async () => {
      const { data } = await supabase
        .from("user_media")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (data) {
        try {
          const meta = (data.metadata || {}) as any;
          setStory({
            id: data.id,
            title: data.title || "Untitled Story",
            genre: meta.genre || "Fantasy",
            premise: meta.premise || "",
            chapters: meta.chapters || [{ title: "Chapter 1", content: "" }],
            published: meta.published,
            publishedUrl: meta.publishedUrl,
          });
          setSavingId(data.id);
        } catch {}
      }
    })();
  }, [params, user]);

  // Auto-save to library (debounced)
  useEffect(() => {
    if (!user) return;
    if (!story.title.trim() && !story.premise.trim() && !story.chapters.some(c => c.content.trim())) return;
    const handle = setTimeout(async () => {
      try {
        const wordCount = story.chapters.reduce((n, c) => n + c.content.split(/\s+/).filter(Boolean).length, 0);
        const payload: any = {
          user_id: user.id,
          media_type: "story",
          title: story.title || "Untitled Story",
          url: `oracle-lunar://story/${savingId || "draft"}`,
          source_page: "story-writer",
          metadata: {
            genre: story.genre,
            premise: story.premise,
            chapters: story.chapters,
            wordCount,
            published: story.published || false,
            publishedUrl: story.publishedUrl,
          },
        };
        if (savingId) {
          await supabase.from("user_media").update(payload).eq("id", savingId);
        } else {
          const { data, error } = await supabase
            .from("user_media")
            .insert([payload])
            .select("id")
            .single();
          if (!error && data) setSavingId(data.id);
        }
        qc.invalidateQueries({ queryKey: ["story-writer-library"] });
        qc.invalidateQueries({ queryKey: ["user-media"] });
      } catch (e) {
        console.error("auto-save error", e);
      }
    }, 1500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, user, savingId]);

  const totalWords = useMemo(
    () => story.chapters.reduce((n, c) => n + c.content.split(/\s+/).filter(Boolean).length, 0),
    [story.chapters]
  );

  const callAI = async (
    system: string,
    prompt: string,
    opts?: { model?: string; maxTokens?: number }
  ): Promise<string> => {
    const mod = (await import("@/lib/contentSafety")).moderatePrompt(`${system}\n\n${prompt}`);
    if (!mod.ok) { toast.error(mod.reason || "Prompt blocked by content filter"); throw new Error("blocked"); }
    setAiBusy(true);
    try {
      const resp = await fetch(TOOLS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getEdgeAuthTokenSync()}`,
        },
        body: JSON.stringify({
          type: "assistant",
          prompt: `${system}\n\n${prompt}`,
          model: opts?.model,
          maxTokens: opts?.maxTokens,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return typeof data === "string" ? data : (data.text || data.result || JSON.stringify(data));
    } finally {
      setAiBusy(false);
    }
  };

  // Long-chapter generator: targets 5000+ words, with multi-pass continuation if model returns short.
  const MIN_WORDS = 5000;
  const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

  const generateLongChapter = async (
    chapterTitle: string,
    guidance: string,
    previousContext: string
  ): Promise<string> => {
    const baseSystem = `You are a master ${story.genre} novelist writing a full-length book chapter.
Write a COMPLETE chapter of AT LEAST 5000 words — rich prose, vivid sensory detail, full scenes with dialogue, internal thought, action, and pacing. Do NOT summarize. Do NOT use bullet points. Do NOT include outlines. Write only the chapter prose. You may include the chapter title as the first line.`;

    const userPrompt = `STORY TITLE: ${story.title}
GENRE: ${story.genre}
PREMISE: ${story.premise}

PREVIOUS CHAPTERS (summary/context):
${previousContext || "(none — this is an early chapter)"}

CHAPTER TO WRITE: ${chapterTitle}
USER GUIDANCE FOR THIS CHAPTER:
${guidance || "(no extra guidance — follow the natural arc)"}

Write the full chapter now (5000+ words):`;

    let text = await callAI(baseSystem, userPrompt, {
      model: "google/gemini-2.5-pro",
      maxTokens: 16000,
    });

    // If short, request continuations until we hit MIN_WORDS or 3 attempts.
    let attempts = 0;
    while (wordCount(text) < MIN_WORDS && attempts < 3) {
      attempts++;
      const tail = text.slice(-2000);
      const more = await callAI(
        `You are continuing the same ${story.genre} chapter seamlessly. Do not repeat. Add several more rich scenes/paragraphs to extend the chapter. Continue the prose only.`,
        `STORY: ${story.title}\nCHAPTER: ${chapterTitle}\n\nLAST PORTION:\n${tail}\n\nContinue the chapter (target total ${MIN_WORDS}+ words):`,
        { model: "google/gemini-2.5-pro", maxTokens: 16000 }
      );
      text = (text + "\n\n" + more).trim();
    }
    return text;
  };

  const aiContinue = async () => {
    const ch = story.chapters[activeChapter];
    if (!ch) return;
    const last = ch.content.slice(-1500);
    try {
      const text = await callAI(
        `You are a master ${story.genre} novelist. Continue the story naturally in the established voice. Add 2-3 vivid paragraphs. Do not summarize, do not repeat what's already there. Just continue.`,
        `STORY TITLE: ${story.title}\nPREMISE: ${story.premise}\nCURRENT CHAPTER: ${ch.title}\n\nLATEST TEXT:\n${last}\n\nContinue:`
      );
      setStory(s => {
        const next = [...s.chapters];
        next[activeChapter] = { ...ch, content: (ch.content + "\n\n" + text).trim() };
        return { ...s, chapters: next };
      });
      toast.success("Story continued");
      void saveToLibrary({
        media_type: "text",
        title: `Story: ${story.title}`,
        url: ch.content + "\n\n" + text,
        source_page: "story-writer",
        metadata: { genre: story.genre, chapter: ch.title, action: "continue" },
      });
    } catch (e: any) {
      toast.error("AI continue failed: " + (e?.message || "unknown"));
    }
  };

  const aiOutline = async () => {
    if (!story.premise.trim()) {
      toast.error("Add a premise first");
      return;
    }
    try {
      const text = await callAI(
        `You are a story architect. Produce a clean chapter-by-chapter outline (5-8 chapters) for a ${story.genre} story. Each chapter on its own line as: "Chapter N — Title: one-sentence beat". No prose, just the list.`,
        `Title: ${story.title}\nPremise: ${story.premise}`
      );
      const lines = text.split("\n").map(l => l.trim()).filter(l => /^chapter\s+\d/i.test(l));
      const chapters: StoryChapter[] = lines.length
        ? lines.map(l => ({ title: l.split(":")[0]?.trim() || l, content: "" }))
        : [{ title: "Chapter 1", content: "" }];
      setStory(s => ({ ...s, chapters }));
      setActiveChapter(0);
      toast.success(`Outline ready — ${chapters.length} chapters`);
      void saveToLibrary({
        media_type: "text",
        title: `Story Outline: ${story.title}`,
        url: chapters.map(c => c.title).join("\n"),
        source_page: "story-writer",
        metadata: { genre: story.genre, action: "outline" },
      });
    } catch (e: any) {
      toast.error("Outline failed: " + (e?.message || "unknown"));
    }
  };

  const aiRewrite = async () => {
    const ch = story.chapters[activeChapter];
    if (!ch?.content.trim()) {
      toast.error("Nothing to rewrite yet");
      return;
    }
    try {
      const text = await callAI(
        `You are a master editor. Rewrite the following chapter for stronger prose, sharper imagery, and better pacing while preserving plot, names, and meaning. Return only the revised chapter.`,
        ch.content
      );
      setStory(s => {
        const next = [...s.chapters];
        next[activeChapter] = { ...ch, content: text };
        return { ...s, chapters: next };
      });
      toast.success("Chapter rewritten");
      void saveToLibrary({
        media_type: "text",
        title: `Story Chapter: ${ch.title}`,
        url: text,
        source_page: "story-writer",
        metadata: { genre: story.genre, action: "rewrite" },
      });
    } catch (e: any) {
      toast.error("Rewrite failed: " + (e?.message || "unknown"));
    }
  };

  // Build context summary from previous chapters (truncated)
  const buildPrevContext = (uptoIdx: number): string => {
    return story.chapters
      .slice(0, uptoIdx)
      .map((c, i) => `${c.title}:\n${c.content.slice(0, 800)}${c.content.length > 800 ? "..." : ""}`)
      .join("\n\n");
  };

  const aiGenerateFullChapter = async (guidance?: string) => {
    const ch = story.chapters[activeChapter];
    if (!ch) return;
    try {
      toast.info("Generating full chapter (5000+ words). This may take a minute...");
      const text = await generateLongChapter(
        ch.title,
        guidance ?? chapterGuidance,
        buildPrevContext(activeChapter)
      );
      setStory(s => {
        const next = [...s.chapters];
        next[activeChapter] = { ...ch, content: text };
        return { ...s, chapters: next };
      });
      const wc = text.split(/\s+/).filter(Boolean).length;
      toast.success(`Chapter generated — ${wc.toLocaleString()} words`);
      setChapterGuidance("");
      setFlowStage("askEdit");
      void saveToLibrary({
        media_type: "text",
        title: `Story Chapter: ${ch.title}`,
        url: text,
        source_page: "story-writer",
        metadata: { genre: story.genre, action: "full-chapter", wordCount: wc },
      });
    } catch (e: any) {
      toast.error("Chapter generation failed: " + (e?.message || "unknown"));
    }
  };

  const aiEditChapterWithInstructions = async () => {
    const ch = story.chapters[activeChapter];
    if (!ch?.content.trim()) { toast.error("Nothing to edit"); return; }
    if (!editInstructions.trim()) { toast.error("Tell the AI what to change"); return; }
    try {
      const text = await callAI(
        `You are a master editor. Apply the user's edit instructions to the chapter. Preserve overall plot and length (still 5000+ words). Return only the revised chapter prose.`,
        `EDIT INSTRUCTIONS:\n${editInstructions}\n\nCHAPTER:\n${ch.content}`,
        { model: "google/gemini-2.5-pro", maxTokens: 16000 }
      );
      setStory(s => {
        const next = [...s.chapters];
        next[activeChapter] = { ...ch, content: text };
        return { ...s, chapters: next };
      });
      toast.success("Chapter edited");
      setEditInstructions("");
      setFlowStage("askEdit");
    } catch (e: any) {
      toast.error("Edit failed: " + (e?.message || "unknown"));
    }
  };

  const goToNextChapter = async (guidance: string) => {
    // Add a new chapter if needed, then generate it.
    const newIdx = activeChapter + 1;
    if (newIdx >= story.chapters.length) {
      setStory(s => ({
        ...s,
        chapters: [...s.chapters, { title: `Chapter ${s.chapters.length + 1}`, content: "" }],
      }));
    }
    setActiveChapter(newIdx);
    setNextGuidance("");
    setFlowStage("idle");
    // give state a tick, then generate
    setTimeout(() => { void aiGenerateFullChapter(guidance); }, 50);
  };

  const addChapter = () => {
    setStory(s => ({
      ...s,
      chapters: [...s.chapters, { title: `Chapter ${s.chapters.length + 1}`, content: "" }],
    }));
    setActiveChapter(story.chapters.length);
  };

  const removeChapter = (idx: number) => {
    if (story.chapters.length <= 1) return;
    setStory(s => ({ ...s, chapters: s.chapters.filter((_, i) => i !== idx) }));
    setActiveChapter(0);
  };

  const exportTxt = () => {
    const text = [
      story.title,
      "by " + (user?.email?.split("@")[0] || "Anonymous"),
      "",
      "Premise: " + story.premise,
      "",
      ...story.chapters.flatMap(c => [c.title, "", c.content, ""]),
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${story.title.replace(/[^a-z0-9]+/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const publish = async () => {
    if (!user) { toast.error("Sign in to publish"); return; }
    if (!story.chapters.some(c => c.content.trim())) {
      toast.error("Write at least one chapter before publishing.");
      return;
    }
    const slug = (story.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "story")
      + "-" + Math.random().toString(36).slice(2, 7);
    const publishedUrl = `https://oracle-lunar.online/stories/${slug}`;
    try {
      const wordCount = story.chapters.reduce((n, c) => n + c.content.split(/\s+/).filter(Boolean).length, 0);
      const payload: any = {
        user_id: user.id,
        media_type: "story",
        title: story.title || "Untitled Story",
        url: publishedUrl,
        source_page: "story-writer",
        is_public: true,
        metadata: {
          slug,
          genre: story.genre,
          premise: story.premise,
          chapters: story.chapters,
          wordCount,
          published: true,
          publishedUrl,
          authorName: user.email?.split("@")[0],
        },
      };
      if (savingId) {
        await supabase.from("user_media").update(payload).eq("id", savingId);
      } else {
        const { data } = await supabase.from("user_media").insert([payload]).select("id").single();
        if (data) setSavingId(data.id);
      }
      setStory(s => ({ ...s, published: true, publishedUrl }));
      toast.success("Story published — share it anywhere!", { description: publishedUrl });
      setShareOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to publish");
    }
  };

  const loadSaved = (id: string) => {
    navigate(`/story-writer?id=${id}`);
    window.location.reload();
  };

  return (
    <PaywallGate requiredTier="starter" featureName="Story Writer Studio">
      <div className="min-h-screen bg-background pb-24">
        <UniversalBackButton />

        {/* Header */}
        <div className="px-4 pt-16 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-primary" />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-primary">Story Writer Studio</h1>
              <p className="text-[11px] text-muted-foreground">
                {totalWords.toLocaleString()} words · {story.chapters.length} chapter
                {story.chapters.length === 1 ? "" : "s"} · Auto-saved to your Library
                {isAdmin && <span className="ml-2 text-amber-400 font-semibold">· ADMIN UNLIMITED</span>}
              </p>
            </div>
            <button
              onClick={() => setShareOpen(true)}
              className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
              aria-label="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Saved library strip */}
        {savedStories.length > 0 && (
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[11px] text-muted-foreground mb-2">Your saved stories</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {savedStories.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => loadSaved(s.id)}
                  className={`shrink-0 px-3 py-2 rounded-lg border text-xs ${
                    savingId === s.id
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-card border-border text-foreground hover:border-primary/50"
                  }`}
                >
                  <FileText className="w-3 h-3 inline mr-1" />
                  {s.title || "Untitled"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Title + Genre + Premise */}
        <div className="px-4 py-4 space-y-3">
          <input
            value={story.title}
            onChange={e => setStory(s => ({ ...s, title: e.target.value }))}
            placeholder="Story title..."
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-lg font-bold text-foreground"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {GENRES.map(g => (
              <button
                key={g}
                onClick={() => setStory(s => ({ ...s, genre: g }))}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs border ${
                  story.genre === g
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <textarea
            value={story.premise}
            onChange={e => setStory(s => ({ ...s, premise: e.target.value }))}
            placeholder="One-paragraph premise — who, where, the central conflict..."
            rows={2}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
          />
          <button
            onClick={aiOutline}
            disabled={aiBusy}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Generate Chapter Outline with AI
          </button>
        </div>

        {/* Chapter tabs */}
        <div className="px-4 flex gap-2 overflow-x-auto pb-2 border-b border-border">
          {story.chapters.map((c, i) => (
            <button
              key={i}
              onClick={() => setActiveChapter(i)}
              className={`shrink-0 px-3 py-1.5 rounded-t-lg text-xs ${
                i === activeChapter
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border"
              }`}
            >
              {c.title}
            </button>
          ))}
          <button
            onClick={addChapter}
            className="shrink-0 px-2 py-1.5 rounded-t-lg bg-card border border-border text-primary"
            aria-label="Add chapter"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Chapter editor */}
        <div className="px-4 py-3 space-y-3">
          <div className="flex gap-2">
            <input
              value={story.chapters[activeChapter]?.title || ""}
              onChange={e =>
                setStory(s => {
                  const next = [...s.chapters];
                  next[activeChapter] = { ...next[activeChapter], title: e.target.value };
                  return { ...s, chapters: next };
                })
              }
              className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-sm font-semibold text-foreground"
            />
            {story.chapters.length > 1 && (
              <button
                onClick={() => removeChapter(activeChapter)}
                className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
                aria-label="Delete chapter"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <textarea
            value={story.chapters[activeChapter]?.content || ""}
            onChange={e =>
              setStory(s => {
                const next = [...s.chapters];
                next[activeChapter] = { ...next[activeChapter], content: e.target.value };
                return { ...s, chapters: next };
              })
            }
            placeholder="Start writing... or use the AI buttons below to generate prose."
            rows={16}
            className="w-full bg-card border border-border rounded-lg px-3 py-3 text-sm text-foreground leading-relaxed resize-y font-serif"
          />

          {/* === AI CHAPTER WORKFLOW === */}
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-3">
            {flowStage === "idle" && (
              <>
                <p className="text-xs font-semibold text-primary">
                  ✨ Generate Full Chapter (5,000+ words)
                </p>
                <textarea
                  value={chapterGuidance}
                  onChange={e => setChapterGuidance(e.target.value)}
                  placeholder="Optional: tell the AI what should happen in this chapter (key scenes, characters, tone, twists...). Leave blank to follow the natural arc."
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
                />
                <button
                  onClick={() => aiGenerateFullChapter()}
                  disabled={aiBusy}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Full Chapter
                </button>
              </>
            )}

            {flowStage === "askEdit" && (
              <>
                <p className="text-sm font-semibold text-foreground">
                  ✅ Chapter generated. Would you like to edit it?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFlowStage("editing")}
                    className="py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm"
                  >
                    Yes, edit it
                  </button>
                  <button
                    onClick={() => setFlowStage("askNext")}
                    className="py-2 rounded-lg bg-card border border-border text-foreground font-semibold text-sm"
                  >
                    No, continue
                  </button>
                </div>
              </>
            )}

            {flowStage === "editing" && (
              <>
                <p className="text-xs font-semibold text-primary">
                  ✏️ Edit chapter — describe the changes
                </p>
                <textarea
                  value={editInstructions}
                  onChange={e => setEditInstructions(e.target.value)}
                  placeholder="e.g. Make the dialogue sharper, add a betrayal in the middle, soften the villain's monologue..."
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={aiEditChapterWithInstructions}
                    disabled={aiBusy || !editInstructions.trim()}
                    className="py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    Apply Edits
                  </button>
                  <button
                    onClick={() => { setEditInstructions(""); setFlowStage("askEdit"); }}
                    className="py-2 rounded-lg bg-card border border-border text-foreground text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {flowStage === "askNext" && (
              <>
                <p className="text-sm font-semibold text-foreground">
                  📖 Any suggestions for the next chapter?
                </p>
                <textarea
                  value={nextGuidance}
                  onChange={e => setNextGuidance(e.target.value)}
                  placeholder="Optional: what should happen next? Leave blank and the AI will continue naturally."
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => goToNextChapter(nextGuidance)}
                    disabled={aiBusy}
                    className="py-2 rounded-lg bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate Next Chapter
                  </button>
                  <button
                    onClick={() => setFlowStage("idle")}
                    className="py-2 rounded-lg bg-card border border-border text-foreground text-sm"
                  >
                    Done for now
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Quick AI Tools */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={aiContinue}
              disabled={aiBusy}
              className="py-2 rounded-lg bg-card border border-primary/40 text-primary text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Continue
            </button>
            <button
              onClick={aiRewrite}
              disabled={aiBusy}
              className="py-2 rounded-lg bg-card border border-primary/40 text-primary text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              AI Rewrite
            </button>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="px-4 pt-4 grid grid-cols-3 gap-2">
          <button
            onClick={exportTxt}
            className="py-2 rounded-lg bg-card border border-border text-foreground text-xs flex items-center justify-center gap-1"
          >
            <Download className="w-3 h-3" /> Export
          </button>
          <button
            onClick={() => navigate("/media-library")}
            className="py-2 rounded-lg bg-card border border-border text-foreground text-xs flex items-center justify-center gap-1"
          >
            <Save className="w-3 h-3" /> Library
          </button>
          <button
            onClick={publish}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
              canPublish
                ? "bg-gradient-to-r from-primary to-amber-500 text-primary-foreground"
                : "bg-card border border-border text-muted-foreground"
            }`}
          >
            {canPublish ? <Crown className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {story.published ? "Published" : "Publish"}
          </button>
        </div>

        {story.published && story.publishedUrl && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-primary/10 border border-primary/30 text-xs text-foreground">
            ✨ Live at: <span className="text-primary break-all">{story.publishedUrl}</span>
          </div>
        )}

        {/* Big share-to-social CTA — always available */}
        <div className="px-4 mt-4 mb-8">
          <button
            onClick={() => setShareOpen(true)}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary via-amber-400 to-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/30 hover:scale-[1.01] transition"
          >
            <Share2 className="w-5 h-5" />
            Share to Social Media (WhatsApp, Facebook, X, Instagram, TikTok & more)
          </button>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Publish first to share a public link, or share the Oracle Lunar link to invite friends.
          </p>
        </div>

        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          title={story.title}
          url={story.publishedUrl || "https://oracle-lunar.online"}
          description={`Read "${story.title}" — a ${story.genre} story written in Oracle Lunar.`}
        />
      </div>
    </PaywallGate>
  );
};

export default StoryWriterPage;
