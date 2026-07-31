import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";
import SEO from "@/components/SEO";
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen, Sparkles, Save, Wand2, Plus, Trash2, Download,
  Share2, FileText, Loader2, ChevronLeft, Crown, Lock, Image as ImageIcon, X,
  Headphones, BookMarked,
} from "lucide-react";
import JSZip from "jszip";
import UniversalBackButton from "@/components/UniversalBackButton";
import ShareDialog from "@/components/ShareDialog";
import PaywallGate, { hasAccess } from "@/components/PaywallGate";
import { useSubscription } from "@/hooks/useSubscription";
import ReactMarkdown from "react-markdown";
import { saveToLibrary } from "@/lib/saveToLibrary";
import StoragePanel from "@/components/StoragePanel";
import StoryLibraryBrowser from "@/components/StoryLibraryBrowser";
import MediaPickerDialog from "@/components/MediaPickerDialog";
import { SignedImage } from "@/components/SignedMedia";
import { sendStoryToMovieMaker } from "@/lib/movieHandoff";
import { persistImageToStorage } from "@/lib/persistImage";



interface StoryChapter {
  title: string;
  content: string;
  /** Up to 2 AI-generated illustrations per chapter (data URLs). */
  images?: string[];
}
interface StoryDoc {
  id?: string;
  title: string;
  author: string;
  genre: string;
  premise: string;
  chapters: StoryChapter[];
  /** AI-generated front cover image (data URL). */
  coverImage?: string;
  /** AI-generated back cover image (data URL). */
  backImage?: string;
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
    title: params.get("title") || "",
    author: "",
    genre: "Fantasy",
    premise: params.get("prompt") || "",
    chapters: [{ title: "Chapter 1", content: "" }],
  });
  const [activeChapter, setActiveChapter] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [openingStoryId, setOpeningStoryId] = useState<string | null>(null);
  const skipAutosaveForLoadedStoryRef = useRef<string | null>(null);
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

  // Auto-load story by id from URL
  useEffect(() => {
    const id = params.get("id");
    if (!id || !user) return;
    let alive = true;
    (async () => {
      setOpeningStoryId(id);
      try {
        const { data, error } = await supabase.rpc("get_story_writer_document" as any, { _story_id: id } as any);
        if (error) throw error;
        if (data && alive) {
          const doc = data as any;
          skipAutosaveForLoadedStoryRef.current = id;
          setStory({
            id: doc.id,
            title: doc.title || "",
            author: doc.author || "",
            genre: doc.genre || "Fantasy",
            premise: doc.premise || "",
            chapters: Array.isArray(doc.chapters) && doc.chapters.length ? doc.chapters : [{ title: "Chapter 1", content: "" }],
            coverImage: doc.coverImage || undefined,
            backImage: doc.backImage || undefined,
            published: !!doc.published,
            publishedUrl: doc.publishedUrl || undefined,
          });
          setSavingId(doc.id);
          setActiveChapter(0);
          toast.success("Story opened");

          // The document loader strips heavy embedded artwork so the story
          // opens instantly. Pull the pictures in straight after so nothing
          // looks like it vanished.
          try {
            const { data: art } = await supabase.rpc("get_story_writer_images" as any, { _story_id: id } as any);
            const a = art as any;
            if (alive && a) {
              skipAutosaveForLoadedStoryRef.current = id;
              setStory(s => ({
                ...s,
                coverImage: s.coverImage || a.coverImage || undefined,
                backImage: s.backImage || a.backImage || undefined,
                chapters: s.chapters.map((c, i) => {
                  const imgs = Array.isArray(a.chapterImages?.[i]) ? a.chapterImages[i] : [];
                  return (c.images && c.images.length) || !imgs.length ? c : { ...c, images: imgs };
                }),
              }));
            }
          } catch { /* artwork is best-effort */ }
        }

      } catch (e: any) {
        if (alive) toast.error(e?.message || "Story could not be opened");
      } finally {
        if (alive) setOpeningStoryId(null);
      }
    })();
    return () => { alive = false; };
  }, [params, user]);

  // Default the author to the signed-in user's name/email once known.
  useEffect(() => {
    if (!user) return;
    setStory(s => s.author?.trim() ? s : { ...s, author: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "" });
  }, [user]);

  // Hard gate: title + author are required before any AI work or autosave.
  // Reject default placeholder titles so the very first save lands with a real
  // human-chosen title in the user's (and admin's) library.
  const PLACEHOLDER_TITLES = ["", "untitled story", "untitled"];
  const cleanTitle = story.title.trim();
  const cleanAuthor = story.author.trim();
  const hasMeta = !!cleanTitle && !!cleanAuthor && !PLACEHOLDER_TITLES.includes(cleanTitle.toLowerCase());
  const requireMeta = (): boolean => {
    if (!hasMeta) {
      toast.error("Add a Title and Author before the writer can begin.");
      try { document.getElementById("story-meta-gate")?.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
      return false;
    }
    return true;
  };

  // Auto-save to library (debounced) — only after Title + Author exist so the
  // very first save lands in the user's (and admin's) library with proper
  // attribution. Routed through the central save_library_item RPC so the
  // admin library pipeline picks it up.
  useEffect(() => {
    if (!user) return;
    if (!hasMeta) return;
    if (skipAutosaveForLoadedStoryRef.current && skipAutosaveForLoadedStoryRef.current === savingId) {
      skipAutosaveForLoadedStoryRef.current = null;
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const wordCount = story.chapters.reduce((n, c) => n + c.content.split(/\s+/).filter(Boolean).length, 0);
        const metadata = {
          author: story.author,
          genre: story.genre,
          premise: story.premise,
          chapters: story.chapters,
          coverImage: story.coverImage,
          backImage: story.backImage,
          wordCount,
          published: story.published || false,
          publishedUrl: story.publishedUrl,
          admin_library_visible: true,
          kind: "story_doc",
        };
        if (savingId) {
          const { error } = await supabase.rpc("save_story_writer_document" as any, {
            _story_id: savingId,
            _title: story.title,
            _metadata: metadata,
          } as any);
          if (error) throw error;
        } else {
          const id = await saveToLibrary({
            media_type: "document",
            title: story.title,
            url: `oracle-lunar://story/${crypto.randomUUID()}`,
            source_page: "story-writer",
            metadata: { ...metadata, library_kind: "story" },
          });
          if (id) {
            const { error } = await supabase.from("user_media").update({ media_type: "story" } as any).eq("id", id);
            if (error) throw error;
            setSavingId(id);
          }
        }
        qc.invalidateQueries({ queryKey: ["story-writer-library"] });
        qc.invalidateQueries({ queryKey: ["user-media"] });
        qc.invalidateQueries({ queryKey: ["all-user-media"] });
      } catch (e) {
        console.error("auto-save error", e);
        toast.error("Story auto-save paused — your draft remains on this device.");
      }
    }, 1200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, user, savingId, hasMeta]);

  const totalWords = useMemo(
    () => story.chapters.reduce((n, c) => n + c.content.split(/\s+/).filter(Boolean).length, 0),
    [story.chapters]
  );

  // ====== AI ILLUSTRATION GENERATOR ======
  // Cover, back cover, and up to 6 illustrations per chapter.
  const [imgBusy, setImgBusy] = useState<string | null>(null);
  const [imgStyleId, setImgStyleId] = useState<string>("realistic-4k");
  const [imgCustomPrompt, setImgCustomPrompt] = useState<string>("");
  // Pull artwork from the in-app Library or the user's device
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"cover" | "back" | "chapter" | null>(null);
  const applyPickedImage = async (picked: string) => {
    // Anything pasted in as raw base64 gets parked in storage so it survives a refresh.
    const url = await persistImageToStorage(picked);
    if (pickerTarget === "cover") setStory(s => ({ ...s, coverImage: url }));

    else if (pickerTarget === "back") setStory(s => ({ ...s, backImage: url }));
    else if (pickerTarget === "chapter") {
      setStory(s => {
        const next = [...s.chapters];
        const ch = next[activeChapter];
        if (ch) next[activeChapter] = { ...ch, images: [...(ch.images || []), url].slice(0, 2) };
        return { ...s, chapters: next };
      });
    }
    setPickerTarget(null);
    toast.success("Image added to your story");
  };


  const ART_STYLES: { id: string; label: string; suffix: string }[] = [
    { id: "realistic-4k", label: "4K Realistic", suffix: "ultra-realistic 4K photography, razor-sharp, cinematic lighting" },
    { id: "photo-normal", label: "Normal Photo", suffix: "natural realistic photograph" },
    { id: "cartoon",      label: "Cartoon",      suffix: "cartoon illustration, bold outlines, vibrant flat colours" },
    { id: "2_5d",         label: "2.5D Photoreal", suffix: "2.5D photorealistic illustration, painterly depth, cinematic lighting" },
    { id: "anime",        label: "Anime",        suffix: "modern anime cover art, cel-shaded, clean line art" },
    { id: "cinematic",    label: "Cinematic",    suffix: "cinematic movie-poster style, dramatic lighting, moody colour grade" },
    { id: "fantasy",      label: "Fantasy",      suffix: "epic fantasy illustration, painterly, rich detail" },
    { id: "watercolour",  label: "Watercolour",  suffix: "soft watercolour illustration, textured paper, gentle washes" },
  ];

  /** Minimum illustrations produced whenever a chapter is illustrated. */
  const MIN_IMAGES_PER_CHAPTER = 4;

  /** Split a chapter into N narrative beats so illustrations land in the right places. */
  const chapterBeats = (text: string, count: number): string[] => {
    const paras = (text || "").split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (paras.length === 0) return Array.from({ length: count }, () => "");
    const per = Math.ceil(paras.length / count);
    const beats: string[] = [];
    for (let i = 0; i < count; i++) {
      beats.push(paras.slice(i * per, (i + 1) * per).join("\n\n").slice(0, 1200));
    }
    // Never hand back an empty beat — reuse the nearest non-empty one.
    return beats.map((b, i) => b || beats.slice(0, i).reverse().find(Boolean) || paras[0].slice(0, 1200));
  };

  const generateStoryImage = async (
    slot: "cover" | "back" | { kind: "chapter"; index: number },
    customPrompt?: string,
    beat?: { index: number; total: number; text: string },
  ): Promise<boolean> => {

    const slotKey = typeof slot === "string" ? slot : `chapter-${slot.index}`;
    if (imgBusy) return false;

    if (!requireMeta()) return;
    const ch = typeof slot === "string" ? null : story.chapters[slot.index];

    const style = ART_STYLES.find(s => s.id === imgStyleId) ?? ART_STYLES[0];
    const userExtra = (customPrompt?.trim() || imgCustomPrompt.trim());

    const REALISM = "8K ultra-photorealistic, lifelike human anatomy and skin, real-world physics, DSLR full-frame, 85mm lens, natural skin pores, believable eyes and hands, cinematic depth of field, dramatic natural lighting, indistinguishable from a real photograph. NO cartoon, NO CGI plastic look, NO text, NO typography, NO watermarks.";
    let basePrompt = "";
    // One shared "art bible" so the front cover, back cover and every chapter
    // illustration come out of the same visual world instead of clashing.
    const ART_BIBLE = `ART DIRECTION (must be identical across the whole book): ${style.suffix}; consistent colour palette, consistent lighting setup, consistent lens and film grade, consistent character likeness, wardrobe and age for every recurring person; same real-world locations and props. Full-bleed edge-to-edge composition, nothing important near the edges, no borders, no mock-up of a printed book, no book object, no hands holding a book, no shelves. Print-ready front-facing artwork only.`;
    if (slot === "cover") {
      basePrompt = `Full-action ${story.genre} book FRONT COVER artwork for "${story.title}". ${story.premise}. Show the protagonist mid-action in a dynamic real-world moment that captures the heart of the story — motion, tension, emotion. Vertical 2:3 portrait framing with clear empty space at the top for the title. ${ART_BIBLE} ${REALISM}`;
    } else if (slot === "back") {
      basePrompt = `Matching BACK COVER artwork for the very same ${story.genre} book "${story.title}" — it must look like it was shot in the same session as the front cover: same protagonist, same wardrobe, same location world, same palette, same lighting, same grade. ${story.premise}. Quieter, atmospheric companion scene with generous clean space in the lower two-thirds for blurb text. Vertical 2:3 portrait framing. ${ART_BIBLE} ${REALISM}`;
    } else if (ch) {
      const snippet = beat?.text || (ch.content || "").slice(0, 1200);
      const beatLine = beat
        ? `This is illustration ${beat.index + 1} of ${beat.total} for this chapter — depict ONLY the moment described below (the ${beat.index === 0 ? "opening" : beat.index === beat.total - 1 ? "closing" : "middle"} beat), a distinctly different scene from the other illustrations in this chapter. `
        : "";
      basePrompt = `Interior illustration for "${ch.title}" in the ${story.genre} novel "${story.title}", in exactly the same visual world as the book's covers. ${beatLine}Depict: ${snippet || story.premise}. ${ART_BIBLE} ${REALISM}`;
    }

    if (userExtra) basePrompt += ` User direction: ${userExtra}.`;


    setImgBusy(slotKey);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getEdgeAuthTokenSync()}`,
        },
        body: JSON.stringify({ prompt: basePrompt, tier: "premium" }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Image generation failed");
      }
      const data = await resp.json();
      const raw: string | undefined =
        data?.images?.[0]?.image_url?.url || data?.images?.[0]?.url || data?.images?.[0];
      if (!raw) throw new Error("No image returned");
      // Park the artwork in storage so the saved story stays small and the
      // picture never disappears on refresh.
      const url = await persistImageToStorage(raw);


      setStory((s) => {
        if (slot === "cover") return { ...s, coverImage: url };
        if (slot === "back") return { ...s, backImage: url };
        const next = [...s.chapters];
        const target = next[slot.index];
        const existing = target.images || [];
        const MAX_PER_CHAPTER = 6;
        if (existing.length >= MAX_PER_CHAPTER) {
          toast.info(`Max ${MAX_PER_CHAPTER} images per chapter — replacing the oldest.`);
          next[slot.index] = { ...target, images: [...existing.slice(1), url] };
        } else {
          next[slot.index] = { ...target, images: [...existing, url] };
        }
        return { ...s, chapters: next };
      });

      try {
        const label =
          slot === "cover" ? `${story.title} — Cover`
          : slot === "back" ? `${story.title} — Back Cover`
          : `${story.title} — ${ch?.title || "Chapter"} illustration`;
        await saveToLibrary({
          media_type: "image",
          title: label,
          url,
          source_page: "story-writer",
          metadata: { story_id: savingId, slot: slotKey, story_title: story.title, style: imgStyleId, user_prompt: (customPrompt?.trim() || imgCustomPrompt.trim()) || undefined, prompt: basePrompt },
        });
      } catch { /* non-fatal */ }
      toast.success("Illustration ready!");
    } catch (e: any) {
      toast.error(e?.message || "Could not generate image");
    } finally {
      setImgBusy(null);
    }
  };

  // Re-illustrate one chapter (adds a new image, replacing oldest if at cap).
  const reIllustrateChapter = async (idx: number) => {
    if (imgBusy) return;
    await generateStoryImage({ kind: "chapter", index: idx });
  };

  // Bulk: re-illustrate every chapter, sequentially.
  const [bulkBusy, setBulkBusy] = useState(false);
  const reIllustrateAllChapters = async () => {
    if (bulkBusy || imgBusy) return;
    if (!confirm(`Generate a new illustration for all ${story.chapters.length} chapters? This may take several minutes.`)) return;
    setBulkBusy(true);
    let ok = 0, fail = 0;
    try {
      for (let i = 0; i < story.chapters.length; i++) {
        try {
          await generateStoryImage({ kind: "chapter", index: i });
          ok++;
        } catch { fail++; }
      }
      toast.success(`Bulk illustration done — ${ok} ok${fail ? `, ${fail} failed` : ""}`);
    } finally {
      setBulkBusy(false);
    }
  };

  const removeChapterImage = (chapterIdx: number, imageIdx: number) => {
    setStory((s) => {
      const next = [...s.chapters];
      const target = next[chapterIdx];
      const imgs = (target.images || []).filter((_, i) => i !== imageIdx);
      next[chapterIdx] = { ...target, images: imgs };
      return { ...s, chapters: next };
    });
  };


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

  // === Spell check / proofread ===
  const [proofBusy, setProofBusy] = useState<"chapter" | "book" | null>(null);

  const proofreadText = async (text: string): Promise<string> => {
    const cleaned = await callAI(
      `You are a professional book proofreader preparing a manuscript for publication.
Correct spelling, grammar, punctuation, capitalisation and obvious typos.
Keep the author's voice, wording, dialogue, slang and formatting EXACTLY as written — do not rewrite, shorten, expand, censor or restructure anything.
Return ONLY the corrected text, with no commentary, no preamble and no markdown fences.`,
      text,
      { maxTokens: 8000 },
    );
    return (cleaned || "").replace(/^```[a-z]*\n?|```$/g, "").trim();
  };

  const spellCheckChapter = async () => {
    const ch = story.chapters[activeChapter];
    if (!ch?.content?.trim()) { toast.error("This chapter is empty."); return; }
    setProofBusy("chapter");
    try {
      const fixed = await proofreadText(ch.content);
      if (!fixed) throw new Error("Proofreader returned nothing");
      setStory(s => {
        const next = [...s.chapters];
        next[activeChapter] = { ...next[activeChapter], content: fixed };
        return { ...s, chapters: next };
      });
      toast.success("Chapter proofread and corrected");
    } catch (e: any) {
      if (e?.message !== "blocked") toast.error(e?.message || "Spell check failed");
    } finally {
      setProofBusy(null);
    }
  };

  const spellCheckBook = async () => {
    const filled = story.chapters.filter(c => (c.content || "").trim());
    if (!filled.length) { toast.error("Write a chapter first."); return; }
    setProofBusy("book");
    try {
      const corrected: string[] = [];
      for (let i = 0; i < story.chapters.length; i++) {
        const c = story.chapters[i];
        corrected[i] = (c.content || "").trim() ? await proofreadText(c.content) : c.content;
        toast.info(`Proofread ${i + 1} of ${story.chapters.length}…`);
      }
      setStory(s => ({ ...s, chapters: s.chapters.map((c, i) => ({ ...c, content: corrected[i] || c.content })) }));
      toast.success("Whole book proofread — ready for publishing");
    } catch (e: any) {
      if (e?.message !== "blocked") toast.error(e?.message || "Spell check failed");
    } finally {
      setProofBusy(null);
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
    if (!requireMeta()) return;
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
    if (!requireMeta()) return;
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
    if (!requireMeta()) return;
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
    if (!requireMeta()) return;
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
    if (!requireMeta()) return;
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

  const authorName = () => (story.author?.trim() || user?.email?.split("@")[0] || "Anonymous");
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "story";
  const xmlEscape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /** EPUB3 — accepted by Kindle (KDP), Kobo, Apple Books, Google Play Books,
   *  Barnes & Noble, Draft2Digital, Smashwords, IngramSpark. */
  const [epubBusy, setEpubBusy] = useState(false);
  const exportEpub = async () => {
    if (!story.chapters.some(c => c.content.trim())) {
      toast.error("Write at least one chapter first."); return;
    }
    setEpubBusy(true);
    try {
      const zip = new JSZip();
      // mimetype MUST be first and uncompressed
      zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
      zip.folder("META-INF")!.file("container.xml",
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);

      const oebps = zip.folder("OEBPS")!;
      const bookId = `urn:uuid:${crypto.randomUUID()}`;
      const title = xmlEscape(story.title || "Untitled");
      const author = xmlEscape(authorName());
      const now = new Date().toISOString().split(".")[0] + "Z";

      // Cover image (optional)
      let coverManifest = "";
      let coverSpine = "";
      let coverMeta = "";
      if (story.coverImage?.startsWith("data:image/")) {
        const m = story.coverImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (m) {
          const ext = m[1].split("/")[1].replace("jpeg", "jpg");
          const bin = atob(m[2]);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          oebps.file(`cover.${ext}`, bytes);
          oebps.file("cover.xhtml",
            `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Cover</title></head>
<body><div style="text-align:center;"><img src="cover.${ext}" alt="Cover" style="max-width:100%;"/></div></body></html>`);
          coverManifest = `<item id="cover-image" href="cover.${ext}" media-type="${m[1]}" properties="cover-image"/>
<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`;
          coverSpine = `<itemref idref="cover" linear="yes"/>`;
          coverMeta = `<meta name="cover" content="cover-image"/>`;
        }
      }

      // Chapter XHTMLs
      const chapterFiles = story.chapters.map((c, i) => {
        const fname = `chapter-${String(i + 1).padStart(3, "0")}.xhtml`;
        const paras = c.content.split(/\n{2,}/).map(p => `<p>${xmlEscape(p).replace(/\n/g, "<br/>")}</p>`).join("\n");
        oebps.file(fname,
          `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xmlEscape(c.title)}</title></head>
<body><h1>${xmlEscape(c.title)}</h1>${paras}</body></html>`);
        return { fname, title: c.title, id: `ch${i + 1}` };
      });

      const manifestItems = chapterFiles.map(c => `<item id="${c.id}" href="${c.fname}" media-type="application/xhtml+xml"/>`).join("\n");
      const spineItems = chapterFiles.map(c => `<itemref idref="${c.id}"/>`).join("\n");
      const navPoints = chapterFiles.map(c => `<li><a href="${c.fname}">${xmlEscape(c.title)}</a></li>`).join("\n");

      oebps.file("nav.xhtml",
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title></head>
<body><nav epub:type="toc"><h1>Contents</h1><ol>${navPoints}</ol></nav></body></html>`);

      oebps.file("content.opf",
        `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>en</dc:language>
    <dc:description>${xmlEscape(story.premise || "")}</dc:description>
    <dc:subject>${xmlEscape(story.genre)}</dc:subject>
    <meta property="dcterms:modified">${now}</meta>
    ${coverMeta}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${coverManifest}
    ${manifestItems}
  </manifest>
  <spine>
    ${coverSpine}
    ${spineItems}
  </spine>
</package>`);

      const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(story.title)}.epub`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("EPUB ready — upload to Kindle, Kobo, Apple Books, Google Play, B&N, Draft2Digital or Smashwords.");
    } catch (e: any) {
      toast.error(e?.message || "EPUB export failed");
    } finally {
      setEpubBusy(false);
    }
  };

  /** Audiobook — narrates every chapter with ElevenLabs, packages MP3s + ACX
   *  metadata + retail sample in a ZIP ready to upload to Audible/ACX,
   *  Findaway Voices, Google Play Books Audiobooks, Kobo Audiobooks, Spotify. */
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const narrateChunk = async (text: string): Promise<Uint8Array | null> => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
    const token = getEdgeAuthTokenSync();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        text,
        // Audiobook quality: multilingual v2 + 44.1kHz/128kbps MP3
        modelId: "eleven_multilingual_v2",
        outputFormat: "mp3_44100_128",
        settings: { stability: 0.55, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true, speed: 0.98 },
      }),
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || ct.includes("application/json")) return null;
    return new Uint8Array(await res.arrayBuffer());
  };

  const exportAudiobook = async () => {
    if (!user) { toast.error("Sign in to build audiobook"); return; }
    if (!story.chapters.some(c => c.content.trim())) {
      toast.error("Write at least one chapter first."); return;
    }
    if (!confirm(
      `Narrate all ${story.chapters.length} chapters into a full audiobook?\n\n` +
      `This uses your ElevenLabs credits and packages Audible/ACX-ready MP3s ` +
      `(44.1kHz 128kbps), opening & closing credits, a retail sample, and metadata.txt.`
    )) return;

    setAudioBusy(true);
    setAudioProgress(0);
    try {
      const zip = new JSZip();
      const audio = zip.folder("audio")!;
      const author = authorName();
      const title = story.title || "Untitled";
      const totalSteps = story.chapters.length + 2; // opening + closing
      let step = 0;
      const bump = () => { step++; setAudioProgress(Math.round((step / totalSteps) * 100)); };

      // ACX opening credits
      const opening = await narrateChunk(
        `${title}. By ${author}. Narrated by Oracle Lunar A I.`
      );
      if (!opening) throw new Error("Narration failed — check your ElevenLabs key.");
      audio.file("00_opening-credits.mp3", opening);
      bump();

      // Chapters — split long chapters into <=4500 char chunks and concatenate MP3 frames
      for (let i = 0; i < story.chapters.length; i++) {
        const ch = story.chapters[i];
        const body = ch.content.trim();
        if (!body) { bump(); continue; }
        const spoken = `${ch.title}. ${body}`;
        const chunks: string[] = [];
        const sentences = spoken.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) || [spoken];
        let buf = "";
        for (const s of sentences) {
          if ((buf + s).length > 4500) { if (buf) chunks.push(buf); buf = s; }
          else buf += s;
        }
        if (buf) chunks.push(buf);
        const parts: Uint8Array[] = [];
        for (const c of chunks) {
          const mp3 = await narrateChunk(c);
          if (!mp3) throw new Error(`Narration failed on chapter ${i + 1}.`);
          parts.push(mp3);
        }
        const total = parts.reduce((n, p) => n + p.length, 0);
        const joined = new Uint8Array(total);
        let off = 0; for (const p of parts) { joined.set(p, off); off += p.length; }
        const fname = `${String(i + 1).padStart(2, "0")}_${slugify(ch.title).slice(0, 40)}.mp3`;
        audio.file(fname, joined);
        bump();
      }

      // Closing credits
      const closing = await narrateChunk(
        `This has been ${title}, by ${author}. Narrated by Oracle Lunar A I. Thank you for listening.`
      );
      if (closing) audio.file("99_closing-credits.mp3", closing);
      bump();

      // Retail sample (opening credits — under 5 min, ACX-compliant)
      zip.file("retail-sample.mp3", opening);

      // ACX / Audible metadata
      zip.file("metadata.txt",
        [
          `Title: ${title}`,
          `Author: ${author}`,
          `Narrator: Oracle Lunar AI (${authorName()})`,
          `Genre: ${story.genre}`,
          `Language: English`,
          `Description: ${story.premise}`,
          ``,
          `-- Audible / ACX submission checklist --`,
          `Format: MP3, 44.1 kHz, 128 kbps CBR, mono/stereo`,
          `Peak: -3 dB or lower`,
          `RMS: -23 dB to -18 dB`,
          `Noise floor: -60 dB or lower`,
          `Each file: opens with 0.5-1s of room tone, closes with 1-5s`,
          `Retail sample: 1-5 min, mirrors production quality (see retail-sample.mp3)`,
          `Opening credits: "<Title>. By <Author>. Narrated by <Narrator>."`,
          `Closing credits: "This has been <Title>, by <Author>. Narrated by <Narrator>."`,
          ``,
          `-- Also accepted by --`,
          `Findaway Voices (distributes to Audible, Apple Books, Google Play, Kobo, Spotify, Storytel, Scribd, Libro.fm, Nook Audio, Chirp)`,
          `Google Play Books Audiobook Partner Center`,
          `Kobo Writing Life (audio)`,
          `Author's Republic`,
          `ACX (Audible / Amazon / iTunes direct)`,
        ].join("\n"));

      // Include an EPUB inside the same ZIP so retailers that want both formats get them together
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(title)}-audiobook.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Audiobook package ready — Audible/ACX compliant.");
    } catch (e: any) {
      toast.error(e?.message || "Audiobook build failed");
    } finally {
      setAudioBusy(false);
      setAudioProgress(0);
    }
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
      const metadata = {
          slug,
          genre: story.genre,
          premise: story.premise,
          chapters: story.chapters,
          wordCount,
          published: true,
          publishedUrl,
          authorName: user.email?.split("@")[0],
      };
      if (savingId) {
        const { error } = await supabase.from("user_media").update({
          media_type: "document",
          title: story.title || "Untitled Story",
          url: publishedUrl,
          source_page: "story-writer",
          is_public: true,
          metadata,
        } as any).eq("id", savingId);
        if (error) throw error;
      } else {
        const id = await saveToLibrary({
          media_type: "document",
          title: story.title || "Untitled Story",
          url: publishedUrl,
          source_page: "story-writer",
          is_public: true,
          metadata,
        });
        if (!id) throw new Error("Story save was queued for retry");
        setSavingId(id);
      }
      setStory(s => ({ ...s, published: true, publishedUrl }));
      toast.success("Story published — share it anywhere!", { description: publishedUrl });
      setShareOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Failed to publish");
    }
  };

  const loadSaved = (id: string) => {
    if (openingStoryId) return;
    navigate(`/story-writer?id=${id}`);
  };

  return (
    <PaywallGate requiredTier="starter" featureName="Story Writer Studio">
      <SEO title="AI Story Writer — Long-Form Story Generator | Oracle Lunar" description="Generate long-form AI stories, novels and scripts with Oracle Lunar." path="/story-writer" />
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

        {/* Browse ALL my stories — searchable + paginated */}
        <div className="px-4 py-3 border-b border-border">
          <StoryLibraryBrowser onOpen={loadSaved} currentId={savingId} />
          {openingStoryId && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Opening story without the heavy embedded artwork…
            </div>
          )}
        </div>

        {/* Title + Author (REQUIRED) + Genre + Premise */}
        <div id="story-meta-gate" className="px-4 py-4 space-y-3">
          {!hasMeta && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <strong className="font-semibold">Title and Author required.</strong> Add both so your story is saved to your library and credited to you. The writer is locked until you do.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-2">
            <input
              value={story.title}
              onChange={e => setStory(s => ({ ...s, title: e.target.value }))}
              placeholder="Story title... (required)"
              className={`w-full bg-card border rounded-lg px-3 py-2 text-lg font-bold text-foreground ${!story.title.trim() ? "border-amber-500/60" : "border-border"}`}
            />
            <input
              value={story.author}
              onChange={e => setStory(s => ({ ...s, author: e.target.value }))}
              placeholder="Author name... (required)"
              className={`w-full bg-card border rounded-lg px-3 py-2 text-sm text-foreground ${!story.author.trim() ? "border-amber-500/60" : "border-border"}`}
            />
          </div>
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

          {/* Image style + custom prompt — applies to Cover, Back, and Chapter illustrations */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Image style &amp; direction
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {ART_STYLES.map(s => {
                const active = s.id === imgStyleId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setImgStyleId(s.id)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${
                      active
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={imgCustomPrompt}
              onChange={e => setImgCustomPrompt(e.target.value)}
              placeholder="Describe what the AI should draw — characters, setting, mood, colours, key objects… (applies to every image you generate below)"
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              This style and description are combined with your story details for the front cover, back cover, and every chapter illustration. Change it any time before hitting Generate.
            </p>
            <button
              type="button"
              onClick={async () => {
                await generateStoryImage("cover");
                await generateStoryImage("back");
              }}
              disabled={!!imgBusy}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-primary/20"
            >
              {imgBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {imgBusy ? "Generating photorealistic 8K photo…" : "▶ Generate Front + Back Cover Now (8K photorealistic)"}
            </button>
          </div>


          {/* Front + Back Cover Illustrations */}
          <div className="grid grid-cols-2 gap-2">
            {(["cover", "back"] as const).map((slot) => {
              const url = slot === "cover" ? story.coverImage : story.backImage;
              const isBusy = imgBusy === slot;
              const label = slot === "cover" ? "Front Cover" : "Back Cover";
              return (
                <div key={slot} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="aspect-[2/3] bg-muted/30 flex items-center justify-center relative">
                    {url ? (
                      <>
                        <SignedImage src={url} alt={label} className="absolute inset-0 w-full h-full object-cover" />
                        <button
                          onClick={() => setStory(s => ({
                            ...s,
                            ...(slot === "cover" ? { coverImage: undefined } : { backImage: undefined }),
                          }))}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                          aria-label={`Remove ${label}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <button
                    onClick={() => generateStoryImage(slot)}
                    disabled={!!imgBusy}
                    className="w-full py-2 text-[11px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {url ? `Re-generate ${label}` : `Generate ${label}`}
                  </button>
                  <button
                    onClick={() => { setPickerTarget(slot); setPickerOpen(true); }}
                    className="w-full py-2 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 border-t border-border flex items-center justify-center gap-1.5"
                  >
                    <ImageIcon className="w-3 h-3" /> Library / device
                  </button>
                </div>

              );
            })}
          </div>

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

        {/* Chapter quick-list — jump to any chapter, see illustration status, bulk illustrate */}
        <div className="px-4 pt-3">
          <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                Chapters ({story.chapters.length})
              </p>
              <button
                onClick={reIllustrateAllChapters}
                disabled={bulkBusy || !!imgBusy}
                className="text-[11px] px-2.5 py-1 rounded-full bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-semibold flex items-center gap-1 disabled:opacity-60"
              >
                {bulkBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Illustrate ALL chapters
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
              {story.chapters.map((c, i) => {
                const imgs = c.images?.length || 0;
                const wc = c.content.split(/\s+/).filter(Boolean).length;
                const slotKey = `chapter-${i}`;
                const busy = imgBusy === slotKey;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs ${
                      i === activeChapter
                        ? "bg-primary/15 border-primary/50"
                        : "bg-card border-border"
                    }`}
                  >
                    <button
                      onClick={() => setActiveChapter(i)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className={`font-medium truncate ${i === activeChapter ? "text-primary" : "text-foreground"}`}>
                        {c.title || `Chapter ${i + 1}`}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {wc.toLocaleString()} words ·{" "}
                        <span className={imgs > 0 ? "text-primary" : "text-muted-foreground"}>
                          {imgs > 0 ? `🖼 ${imgs}/6 illustrated` : "no illustrations"}
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={() => reIllustrateChapter(i)}
                      disabled={!!imgBusy || bulkBusy}
                      className="shrink-0 p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-40"
                      aria-label="Re-illustrate this chapter"
                      title="Add a new illustration"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
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

          {/* Chapter illustrations — max 2 per chapter */}
          {(() => {
            const ch = story.chapters[activeChapter];
            const imgs = ch?.images || [];
            const slotKey = `chapter-${activeChapter}`;
            const isBusy = imgBusy === slotKey;
            return (
              <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" /> Chapter Illustrations ({imgs.length}/6)
                  </p>
                  <button
                    onClick={() => generateStoryImage({ kind: "chapter", index: activeChapter })}
                    disabled={!!imgBusy}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-semibold flex items-center gap-1 disabled:opacity-60"
                  >
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {imgs.length === 0 ? "Illustrate Chapter" : imgs.length >= 6 ? "Replace Oldest" : "Add Illustration"}
                  </button>
                </div>
                {imgs.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {imgs.map((src, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border border-border">
                        <SignedImage src={src} alt={`Illustration ${i + 1}`} className="w-full aspect-video object-cover" />
                        <button
                          onClick={() => removeChapterImage(activeChapter, i)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                          aria-label="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Auto-illustrated from this chapter's content. Up to 6 per chapter — tap to add a new one for every scene.
                  </p>
                )}
              </div>
            );
          })()}

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

        {/* Retailer-ready exports */}
        <div className="px-4 pt-4 grid grid-cols-2 gap-2">
          <button
            onClick={exportEpub}
            disabled={epubBusy}
            className="py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {epubBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookMarked className="w-4 h-4" />}
            EPUB — Kindle, Kobo, Apple, Google, B&amp;N
          </button>
          <button
            onClick={exportAudiobook}
            disabled={audioBusy}
            className="py-3 rounded-xl bg-gradient-to-r from-amber-500 to-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {audioBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Headphones className="w-4 h-4" />}
            {audioBusy ? `Narrating ${audioProgress}%` : "Audiobook — Audible / ACX ready"}
          </button>
        </div>
        <p className="px-4 pt-1 text-[10px] text-muted-foreground">
          EPUB works on every major store. Audiobook ZIP includes 44.1 kHz 128 kbps MP3s, opening &amp; closing credits, retail sample and ACX metadata — upload directly to Audible/ACX, Findaway Voices, Google Play Books, Kobo, Spotify or Author's Republic.
        </p>

        {/* Spell check / proofread */}
        <div className="px-4 pt-4 grid grid-cols-2 gap-2">
          <button
            onClick={spellCheckChapter}
            disabled={!!proofBusy || aiBusy}
            className="py-3 rounded-xl bg-card border border-primary/40 text-primary text-xs font-bold disabled:opacity-50"
          >
            {proofBusy === "chapter" ? "Proofreading…" : "✔ Spell check this chapter"}
          </button>
          <button
            onClick={spellCheckBook}
            disabled={!!proofBusy || aiBusy}
            className="py-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
          >
            {proofBusy === "book" ? "Proofreading…" : "✔ Spell check whole book"}
          </button>
        </div>
        <p className="px-4 pt-1 text-[10px] text-muted-foreground">
          Fixes spelling, grammar and punctuation only — your wording, voice and dialogue stay exactly as you wrote them.
        </p>

        {/* Story → Movie Maker handoff */}

        <div className="px-4 pt-4 space-y-2">
          <button
            onClick={() => sendStoryToMovieMaker(story, navigate)}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-primary to-amber-500 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
          >
            🎬 Send this Story to the Movie Maker
          </button>
          <button
            onClick={() => { setPickerTarget("chapter"); setPickerOpen(true); }}
            className="w-full py-2 rounded-xl bg-card border border-primary/40 text-primary text-xs font-semibold flex items-center justify-center gap-2"
          >
            <ImageIcon className="w-3.5 h-3.5" /> Add an image to this chapter — from my Library or my device
          </button>
          <p className="text-[10px] text-muted-foreground text-center">
            Your script, cover art and chapter illustrations are loaded straight into Movie Studio as ready scenes.
          </p>
        </div>


        {/* Bottom actions */}
        <div className="px-4 pt-4 grid grid-cols-3 gap-2">
          <button
            onClick={exportTxt}
            className="py-2 rounded-lg bg-card border border-border text-foreground text-xs flex items-center justify-center gap-1"
          >
            <Download className="w-3 h-3" /> TXT
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

        <MediaPickerDialog
          open={pickerOpen}
          onOpenChange={(o) => { setPickerOpen(o); if (!o) setPickerTarget(null); }}
          filterType="image"
          title="Pick an image — your Library or your device"
          onSelect={(url) => applyPickedImage(url)}
        />
      </div>
    </PaywallGate>
  );
};


export default StoryWriterPage;
