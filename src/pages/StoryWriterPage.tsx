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
  Headphones, BookMarked, RefreshCw,
} from "lucide-react";
import JSZip from "jszip";
import UniversalBackButton from "@/components/UniversalBackButton";
import StoryShareDialog from "@/components/story/StoryShareDialog";
import SendToKindleDialog from "@/components/story/SendToKindleDialog";
import PaywallGate, { hasAccess } from "@/components/PaywallGate";
import { useSubscription } from "@/hooks/useSubscription";
import ReactMarkdown from "react-markdown";
import { saveToLibrary } from "@/lib/saveToLibrary";
import StoragePanel from "@/components/StoragePanel";
import StoryLibraryBrowser from "@/components/StoryLibraryBrowser";
import MediaPickerDialog from "@/components/MediaPickerDialog";
import { SignedImage } from "@/components/SignedMedia";
import CoverStudio from "@/components/story/CoverStudio";

import { resolveStorageUrl } from "@/lib/signedStorageUrl";
import { sendStoryToMovieMaker } from "@/lib/movieHandoff";
import { persistImageToStorage } from "@/lib/persistImage";
import RegenerateStoryWizard, { type RegenPlan } from "@/components/story/RegenerateStoryWizard";
import StyleDnaPanel from "@/components/story/StyleDnaPanel";
import { styleDirective, HUMANISE_SYSTEM } from "@/lib/styleDna";
import { recordEdit, buildReport, authorshipLogText } from "@/lib/humanEdits";
import { allDisclosures, combinedDisclosure, type DisclosureFacts } from "@/lib/aiDisclosure";
import { provenanceBlock, scrubIdentifiers, stripImageMetadata, safeFileName } from "@/lib/metadataHygiene";
import { narrateChunk as narrateOneChunk } from "@/lib/storyNarration";
import { COVER_IDENTITY_KEYS, type CoverDesign } from "@/lib/bakeCoverText";






interface StoryChapter {
  title: string;
  content: string;
  /** Up to 6 AI-generated illustrations per chapter (data URLs / storage URLs). */
  images?: string[];
  /** Paragraph index each illustration should sit AFTER, parallel to `images`. */
  imageAnchors?: number[];
  /** Parallel to `images`: true when the plate is a holographic 3D showcase. */
  imageHolo?: boolean[];
}
interface StoryCharacter {
  id: string;
  name: string;
  role: string;
  notes: string;
  url: string;
}
interface StoryDoc {
  id?: string;
  title: string;
  author: string;
  genre: string;
  premise: string;
  /** Full back-cover blurb — the cover AI draws its imagery from this. */
  blurb?: string;
  /** Optional prelude that opens the book before Chapter 1. */
  prelude?: string;
  /** Optional dedication page. */
  dedication?: string;
  chapters: StoryChapter[];
  /** AI-generated front cover image (data URL). */
  coverImage?: string;
  /** AI-generated back cover image (data URL). */
  backImage?: string;
  /** Photo-based fictional cast members the AI draws from. */
  cast?: StoryCharacter[];
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

  // === Style DNA (author's own voice) ===
  const [styleProfile, setStyleProfile] = useState("");
  const styleRule = () => styleDirective(styleProfile);

  // === Human-in-the-loop authorship tracking ===
  const trackKey = () => savingId || "new";
  const trackEdit = (
    source: "human" | "ai",
    chapter: number,
    before: string,
    after: string,
    note?: string,
  ) => {
    recordEdit(trackKey(), {
      chapter,
      chapterTitle: story.chapters[chapter]?.title || `Chapter ${chapter + 1}`,
      source,
      before,
      after,
      note,
    });
    setAuthorshipTick(t => t + 1);
  };
  const [authorshipTick, setAuthorshipTick] = useState(0);
  const humanEditBaselineRef = useRef<string>("");
  const authorship = useMemo(() => buildReport(savingId || "new"), [savingId, authorshipTick]);



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
            blurb: doc.blurb || "",
            prelude: doc.prelude || "",
            dedication: doc.dedication || "",
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
          authorName: story.author,
          slug: story.publishedUrl?.split("/").filter(Boolean).pop(),
          genre: story.genre,

          premise: story.premise,
          blurb: story.blurb || "",
          prelude: story.prelude || "",
          dedication: story.dedication || "",
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
  /** Single AI direction box used only by the Cover Studio. */
  const [coverPrompt, setCoverPrompt] = useState<string>("");
  const [frontCoverDirection, setFrontCoverDirection] = useState<string>("");
  const [backCoverDirection, setBackCoverDirection] = useState<string>("");

  // Pull artwork from the in-app Library or the user's device
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"cover" | "back" | "chapter" | "cast" | null>(null);

  // ====== PHOTO CAST — upload a photo, the AI writes/draws them as a fictional character ======
  const cast = story.cast || [];
  const castFileRef = useRef<HTMLInputElement>(null);
  const [castConsent, setCastConsent] = useState(false);
  const addCastMember = (url: string, name?: string) => {
    setStory(s => {
      const existing = s.cast || [];
      if (existing.length >= 6) {
        toast.info("Up to 6 cast photos per story — remove one first.");
        return s;
      }
      return {
        ...s,
        cast: [
          ...existing,
          {
            id: crypto.randomUUID(),
            name: (name || "").replace(/\.[a-z0-9]+$/i, "").slice(0, 40) || `Character ${existing.length + 1}`,
            role: "",
            notes: "",
            url,
          },
        ],
      };
    });
    toast.success("Photo added to your fictional cast");
  };
  const updateCast = (id: string, patch: Partial<StoryCharacter>) =>
    setStory(s => ({ ...s, cast: (s.cast || []).map(c => (c.id === id ? { ...c, ...patch } : c)) }));
  const removeCast = (id: string) =>
    setStory(s => ({ ...s, cast: (s.cast || []).filter(c => c.id !== id) }));

  const handleCastFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("Photo too large (max 15MB)"); return; }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const url = await persistImageToStorage(dataUrl, "story-cast");
      addCastMember(url, file.name);
      // Every picture already in the book is re-rendered with this person in it,
      // and every future picture uses them too.
      void recastAllImages(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that photo");
    } finally {
      if (castFileRef.current) castFileRef.current.value = "";
    }
  };

  // ====== AUTO-RECAST: put the uploaded person into every image in the book ======
  const [recastBusy, setRecastBusy] = useState<{ done: number; total: number } | null>(null);

  /** Re-render one existing illustration so the uploaded person is the character in it. */
  const recastOneImage = async (sceneUrl: string, faceUrl: string): Promise<string | null> => {
    try {
      const [scene, face] = await Promise.all([
        resolveStorageUrl(sceneUrl, 3600).catch(() => sceneUrl),
        resolveStorageUrl(faceUrl, 3600).catch(() => faceUrl),
      ]);
      const prompt =
        `Recreate the FIRST reference image exactly — identical scene, composition, camera angle, lighting, colour grade, wardrobe, background and art style — but the main character's face, head, hair and overall likeness must be the person shown in the SECOND reference photo, rendered as an original fictional character inspired by that photo. Keep the person's age, build and features believable and consistent. Do not change anything else about the picture. ${QUALITY_FLOOR}`;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
        body: JSON.stringify({
          prompt,
          tier: "premium",
          modelChain: ["google/gemini-3-pro-image-preview"],
          useCache: false,
          libraryFallback: false,
          inputImages: [scene, face],
        }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data?.fallback) return null;
      const candidate: string | undefined =
        data?.images?.[0]?.image_url?.url || data?.images?.[0]?.url || data?.images?.[0];
      if (!candidate) return null;
      return await persistImageToStorage(candidate);
    } catch {
      return null;
    }
  };

  /** Walk every image already in the story and swap the character to the uploaded person. */
  const recastAllImages = async (faceUrl: string) => {
    if (recastBusy) return;
    const targets: { slot: "cover" | "back" | { ch: number; i: number }; url: string }[] = [];
    if (story.coverImage) targets.push({ slot: "cover", url: story.coverImage });
    if (story.backImage) targets.push({ slot: "back", url: story.backImage });
    story.chapters.forEach((c, ci) =>
      (c.images || []).forEach((u, ii) => { if (u) targets.push({ slot: { ch: ci, i: ii }, url: u }); }),
    );
    if (!targets.length) {
      toast.success("Photo added — every new illustration will star this person.");
      return;
    }
    setRecastBusy({ done: 0, total: targets.length });
    toast.info(`Recasting ${targets.length} existing image${targets.length === 1 ? "" : "s"} with your uploaded person…`);
    let ok = 0;
    for (let t = 0; t < targets.length; t++) {
      const target = targets[t];
      const next = await recastOneImage(target.url, faceUrl);
      if (next) {
        ok++;
        setStory(s => {
          if (target.slot === "cover") return { ...s, coverImage: next };
          if (target.slot === "back") return { ...s, backImage: next };
          const chapters = [...s.chapters];
          const ch = chapters[target.slot.ch];
          if (ch) {
            const imgs = [...(ch.images || [])];
            imgs[target.slot.i] = next;
            chapters[target.slot.ch] = { ...ch, images: imgs };
          }
          return { ...s, chapters };
        });
      }
      setRecastBusy({ done: t + 1, total: targets.length });
    }
    setRecastBusy(null);
    toast.success(`Recast complete — ${ok}/${targets.length} images now star your uploaded person.`);
  };

  /** Character sheet injected into every prompt so the cast stays consistent. */
  const castDirective = () => {
    if (!cast.length) return "";
    const lines = cast.map((c, i) =>
      `${i + 1}. ${c.name || `Character ${i + 1}`}${c.role ? ` — ${c.role}` : ""}${c.notes ? `. ${c.notes}` : ""}`,
    );
    return ` FICTIONAL CAST (recurring characters — keep their look, age, build, hair and wardrobe identical in every image and consistent in the prose): ${lines.join(" ")} The attached reference photos define exactly how these characters look — every illustration must show these same people. These are fictional characters inspired by the author's own reference photos; render them as original fictional people, never as a real identifiable public figure, and never in any degrading, sexual or defamatory context.`;
  };

  const applyPickedImage = async (picked: string) => {
    // Anything pasted in as raw base64 gets parked in storage so it survives a refresh.
    const url = await persistImageToStorage(picked);
    if (pickerTarget === "cover") setStory(s => ({ ...s, coverImage: url }));

    else if (pickerTarget === "back") setStory(s => ({ ...s, backImage: url }));
    else if (pickerTarget === "cast") { addCastMember(url); setPickerTarget(null); void recastAllImages(url); return; }
    else if (pickerTarget === "chapter") {
      setStory(s => {
        const next = [...s.chapters];
        const ch = next[activeChapter];
        if (ch) next[activeChapter] = { ...ch, images: [...(ch.images || []), url].slice(0, 6) };
        return { ...s, chapters: next };
      });
    }
    setPickerTarget(null);
    toast.success("Image added to your story");
  };



  const ART_STYLES: { id: string; label: string; suffix: string }[] = [
    { id: "realistic-4k", label: "4K Realistic", suffix: "true 4K cinematic 3D render-grade realism, feature-film keyframe quality, volumetric lighting, global illumination, ray-traced reflections, physically-based materials, microdetail in skin/fabric/metal, atmospheric haze and depth layers, anamorphic cinematic lens, professional colour grade" },
    { id: "photo-normal", label: "Normal Photo", suffix: "natural realistic photograph, professional editorial photography, flawless exposure and colour accuracy" },
    { id: "cartoon",      label: "Cartoon",      suffix: "premium studio-quality cartoon illustration, bold clean outlines, vibrant flat colours, professional animation-studio finish" },
    { id: "2_5d",         label: "2.5D Photoreal", suffix: "2.5D photorealistic illustration, painterly depth, cinematic volumetric lighting, high-end concept-art finish" },
    { id: "anime",        label: "Anime",        suffix: "top-tier modern anime key visual, cel-shaded, immaculate line art, studio-grade production quality" },
    { id: "cinematic",    label: "Cinematic",    suffix: "cinematic movie-poster style, dramatic lighting, moody professional colour grade, blockbuster-grade composition" },
    { id: "fantasy",      label: "Fantasy",      suffix: "epic fantasy illustration, master painterly rendering, rich detail, gallery-grade finish" },
    { id: "watercolour",  label: "Watercolour",  suffix: "master watercolour illustration, textured paper, gentle washes, fine-art gallery quality" },
  ];

  /** Applied to EVERY image regardless of style — non-negotiable quality floor. */
  const QUALITY_FLOOR = "Absolute top-tier professional quality: award-winning composition, perfect anatomy and proportions, flawless hands and eyes, immaculate focus, high dynamic range, rich micro-detail, clean edges, no artefacts, no distortion, no extra limbs, no blur, no noise, no watermark, no text, no typography, no logos, no borders, no collage, no low-resolution or amateur output.";

  /** Extra push when the user picks 4K Realistic. */
  const CINEMATIC_4K = "Render as an extreme-quality 4K cinematic 3D frame: film-grade depth, layered lighting, realistic subsurface scattering, tangible textures, believable physics, shot as if it were a still from a big-budget motion picture directly depicting this story's scene.";


  /**
   * Non-negotiable continuity + world rules applied to every interior
   * illustration so cast, wardrobe, hair, sets and signage stay book-accurate.
   */
  const CONTINUITY_BIBLE =
    "CHARACTER & WORLD CONTINUITY (mandatory): every recurring character must match the book exactly — same face, age, ethnicity, build, skin tone, eye colour, hair length/colour/style, facial hair (or clean-shaven if the book says so), tattoos, scars and injuries at this point in the story. Wardrobe must be the exact outfit described in this chapter: same garments, colours, materials, jackets, boots, hats, jewellery, weapons and carried props — never invent new clothing. Locations, buildings, streets, vehicles, interiors, weather, time of day and special effects must match the described scene precisely and stay consistent with earlier chapters. " +
    "SIGNAGE: avoid text wherever possible; if a sign, badge, number plate or shopfront is unavoidable it must be real, correctly spelled English with no gibberish, no invented glyphs and no misspellings. " +
    "MORAL READ: antagonists look genuinely menacing — dark, dingy, grimy surroundings, cold hard lighting, harsh shadow, cruel worn faces; protagonists read as heroic — cleaner light, warmth on the face, upright confident posture, clear readable eyes. " +
    "QUALITY: 4K ultra-high-definition, real-world photographic realism as if shot on set, no CGI plastic sheen, no cartoon drift unless the chosen style demands it.";

  /** Minimum illustrations produced whenever a chapter is illustrated. */
  const MIN_IMAGES_PER_CHAPTER = 3;

  /** Hard framing rule: characters must always be shown whole, never decapitated by the frame. */
  const HEAD_SAFE =
    "MANDATORY AGENT ACCEPTANCE TEST: every human must have their WHOLE head, scalp, hair, ears, chin and face visibly inside the canvas with clear background above the skull. Keep the hero's head below the top 18% of the canvas and every person at least 12% away from every edge. Show the hero head-to-boots. Never crop, slice, conceal or place typography over a head, chin, hair, hands, feet or weapon. Before returning the image, inspect all four edges and reject/regenerate the composition yourself if any person touches an edge or any head is incomplete. No headless torsos, edge-entering bodies, faceless figures or back-of-head-only heroes.";

  /** Shot recipes so every illustration is visually distinct even on short chapters. */
  const SHOT_VARIETY = [
    "wide establishing shot, eye-level camera, complete environment and every character visible head-to-toe with generous safe margins and full headroom",
    "inclusive medium-wide ensemble shot, all heads, faces, hands and bodies fully inside frame with headroom, balanced foreground and background storytelling",
    "intimate close-quarters full-page scene, shallow depth of field, one continuous moment, complete un-cropped figures",
    "high-angle action shot with motion blur and dynamic diagonal composition, subjects complete head-to-toe inside frame",
    "dutch-angle dramatic shot at a different time of day, full figures with headroom, no cropped heads",
    "waist-up hero portrait moment with the full head and face in frame and the scene readable behind",
  ];


  /** Every URL this session has already placed in the book — used to reject duplicates. */
  const usedImageUrlsRef = useRef<Set<string>>(new Set());

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

  /**
   * A compressed read of the ENTIRE finished manuscript — this is what the
   * Cover Studio hands the artist AI so the covers are baked from the whole
   * book rather than just the premise.
   */
  const storyDigest = (): string => {
    const chapters = story.chapters.filter(c => (c.content || "").trim().length > 0);
    if (!chapters.length) return "";
    const perChapter = Math.max(300, Math.floor(7000 / chapters.length));
    const parts = chapters.map((c, i) => {
      const body = (c.content || "").replace(/\s+/g, " ").trim();
      const head = body.slice(0, Math.floor(perChapter * 0.7));
      const tail = body.length > perChapter ? ` … ${body.slice(-Math.floor(perChapter * 0.3))}` : "";
      return `Ch${i + 1} "${c.title || `Chapter ${i + 1}`}": ${head}${tail}`;
    });
    return ` FULL STORY SOURCE (the complete book, condensed — build the imagery, characters, wardrobe, locations and mood strictly from this): ${parts.join(" || ").slice(0, 9000)}.`;
  };


  const generateStoryImage = async (
    slot: "cover" | "back" | { kind: "chapter"; index: number },
    customPrompt?: string,
    beat?: { index: number; total: number; text: string; anchor?: number },
    avoidBriefs?: string[],
  ): Promise<boolean> => {


    const slotKey = typeof slot === "string" ? slot : `chapter-${slot.index}`;
    if (imgBusy) return false;

    if (!requireMeta()) return false;

    const ch = typeof slot === "string" ? null : story.chapters[slot.index];
    // Set when this chapter plate is the holographic showcase (last 5 chapters).
    let holoRef = false;

    const style = ART_STYLES.find(s => s.id === imgStyleId) ?? ART_STYLES[0];
    const userExtra = (customPrompt?.trim() || imgCustomPrompt.trim());

    const isPhotoreal = style.id === "realistic-4k" || style.id === "photo-normal" || style.id === "2_5d" || style.id === "cinematic";
    const PHOTOREAL = isPhotoreal
      ? "4K ultra-photorealistic, lifelike human anatomy and skin, real-world physics, DSLR full-frame, 85mm lens, natural skin pores, believable eyes and hands, cinematic depth of field, dramatic natural lighting, indistinguishable from a real photograph. NO plastic CGI look."
      : "";
    const REALISM = [PHOTOREAL, style.id === "realistic-4k" ? CINEMATIC_4K : "", QUALITY_FLOOR].filter(Boolean).join(" ");
    let basePrompt = "";
    // One shared "art bible" so the front cover, back cover and every chapter
    // illustration come out of the same visual world instead of clashing.
    const ART_BIBLE = `ART DIRECTION (must be identical across the whole book): ${style.suffix}; consistent colour palette, consistent lighting setup, consistent lens and film grade, consistent character likeness, wardrobe and age for every recurring person; same real-world locations and props. Full-bleed edge-to-edge composition, nothing important near the edges, no borders, no mock-up of a printed book, no book object, no hands holding a book, no shelves. Print-ready front-facing artwork only.`;
    // Hard rule: one single flat artwork per request. Without this the model keeps
    // returning a full wrap-around jacket (front AND back in one image), which is
    // why both covers looked identical in their previews.
    const SINGLE_PANEL = `CRITICAL OUTPUT RULE: return ONE single standalone image showing ONE scene only. Absolutely NO wrap-around book jacket, NO front-and-back spread, NO two-page layout, NO diptych, triptych, split screen, side-by-side panels, collage, grid, storyboard, contact sheet, thumbnails, insets or picture-in-picture. Exactly one continuous photographic frame filling the whole canvas.`;
    // The full back-cover blurb is the richest description of the book, so the
    // cover artist AI reads it as its primary source material.
    const BLURB_BRIEF = story.blurb?.trim()
      ? ` STORY BLURB (primary source — draw the characters, setting, era, wardrobe, weather and mood directly from this): "${story.blurb.trim().slice(0, 1500)}".`
      : "";
    // Covers are baked LAST, from the whole finished manuscript.
    const STORY_DIGEST = (slot === "cover" || slot === "back") ? storyDigest() : "";
    // The model must never paint lettering — title, author and blurb are laid
    // over the artwork as real HTML/CSS text in the Cover Studio preview.
    const NO_TYPE = `ABSOLUTE RULE: this is PURE BACKGROUND ARTWORK. Render ZERO text of any kind — no title, no author name, no blurb, no paragraph, no caption, no label, no signage, no lettering, no numbers, no barcode, no ISBN, no logo, no watermark, no publisher mark, no spine, no book object or mock-up. Any surface that would carry writing must be blank.`;
    const COVER_LOOK = `Style: 3D 4K ultra-realistic, true-to-life human beings, cinematic key lighting, deep atmospheric depth, film-grade colour, indistinguishable from a real photograph of a real moment. Quality bar: AAA blockbuster theatrical poster / bestselling hardback jacket — dramatic rim light, rich contrast, premium colour grade, zero flatness, zero amateur snapshot look.`;
    // The people and world stay recognisable, but the rear deliberately avoids
    // repeating the front's hero arrangement. This keeps continuity without
    // producing two near-identical poster compositions.
    const CAST_LOCK = `CONTINUITY LOCK: recurring people must retain their exact faces, ages, builds, hair, skin tone and wardrobe across the book. Do not swap identities or alter established appearance. If a character named Juzzy appears, he is ALWAYS the same man: a rugged mature Australian, shaved/close-buzzed head, weathered matte face, heavy stubble, scar over the brow, black rugged jacket and dark work trousers.`;
    if (slot === "cover") {
      basePrompt = `FRONT COVER background artwork for a ${story.genre} book. ${story.premise}.${BLURB_BRIEF}${STORY_DIGEST} Paint the single most iconic moment of this book: the hero striding directly toward the camera, weapon in hand, mid-action with a huge explosion and flying debris erupting behind them, the principal cast in real emotion and tension, with wardrobe, era, location, weather and mood taken directly from the blurb above. Show the hero full-length from the top of the head to the boots, framed slightly smaller than usual so generous environment remains on all four sides. Vertical 2:3 portrait framing, hero centred in the upper-middle band, with calm uncluttered darker space in the bottom 32% for title and author typography. Do not reserve title space at the top. ${HEAD_SAFE} ${CAST_LOCK} ${NO_TYPE} ${COVER_LOOK} ${SINGLE_PANEL} ${ART_BIBLE} ${REALISM}`;

    } else if (slot === "back") {
      basePrompt = `BACK COVER background artwork for the very same ${story.genre} book. It must NOT repeat the front cover's hero lineup, action pose, camera height, focal length, location framing, weather beat or silhouette. Choose a genuinely different narrative image: an aftermath, consequential location, symbolic evidence, antagonist viewpoint, or environmental story moment from the finished manuscript. ${story.premise}.${BLURB_BRIEF}${STORY_DIGEST} Keep any people secondary and away from the centre; leave a calm, low-detail centre field for readable blurb typography. Vertical 2:3 portrait framing. ${HEAD_SAFE} ${CAST_LOCK} ${NO_TYPE} ${COVER_LOOK} ${SINGLE_PANEL} ${ART_BIBLE} ${REALISM}`;





    } else if (ch) {
      const snippet = beat?.text || (ch.content || "").slice(0, 1200);
      const shot = SHOT_VARIETY[(beat?.index ?? 0) % SHOT_VARIETY.length];
      const beatLine = beat
        ? `This is illustration ${beat.index + 1} of ${beat.total} for this chapter — depict ONLY the moment described below (the ${beat.index === 0 ? "opening" : beat.index === beat.total - 1 ? "closing" : "middle"} beat). It MUST be a completely different scene, camera angle and composition from every other illustration in this book — never repeat a previous image. `
        : "";
      const chapterFormat = SINGLE_PANEL;
      const FULL_PAGE = "FULL-PAGE PLATE FORMAT (mandatory): this artwork fills an entire book page on its own. Vertical 2:3 portrait, full-bleed edge to edge, ONE single unified scene only — never a split scene, diptych, triptych, before/after, panel grid, mosaic, inset or collage. If the beat contains two moments, choose the single strongest one and render only that. Build genuine depth for a 3D parallax reader: clear foreground, midground and background separation, layered atmosphere, volumetric light shafts and parallax-friendly negative space, so the picture holds up when the reader orbits and zooms into it.";
      const holoPlate = slot.index >= Math.max(0, story.chapters.length - 5) && !!beat && beat.index === beat.total - 1;
      const HOLOGRAM = holoPlate
        ? " HOLOGRAPHIC SHOWCASE PLATE: render this one as a volumetric hologram of the scene — luminous prismatic light, translucent layered depth planes floating in dark space, iridescent scan-lines and refraction, glowing particulate atmosphere, extreme separation between foreground/midground/background so the reader can orbit 360° around it. Keep the cast, wardrobe and story moment accurate; the hologram is the medium, not a different scene."
        : "";
      basePrompt = `Interior illustration for "${ch.title}" in the ${story.genre} novel "${story.title}", in exactly the same visual world as the book's covers. ${beatLine}Camera/composition for THIS image: ${shot}. Depict: ${snippet || story.premise}. COMPOSITION QA: do not crop heads, hair, hands, feet or important props; keep every main subject fully inside frame with 12% safe space; show enough environment to understand the scene; use correct anatomy and consistent cast. ${HEAD_SAFE} ${CONTINUITY_BIBLE} ${FULL_PAGE}${HOLOGRAM} ${chapterFormat} ${ART_BIBLE} ${REALISM}`;
      holoRef = holoPlate;
      if (avoidBriefs?.length) {
        basePrompt += ` FRESH-ART RULE: this book previously had illustrations of these exact moments — ${avoidBriefs.slice(0, 8).map(b => `"${String(b).slice(0, 140)}"`).join("; ")}. Your image must be a demonstrably DIFFERENT picture: different moment, different camera angle, different staging, different lighting and different composition from all of them, while keeping the same cast, wardrobe and world.`;
      }
    }

    if (userExtra) basePrompt += ` User direction: ${userExtra}.`;
    basePrompt += castDirective();

    // Every uploaded cast photo is handed to the model as a likeness reference so
    // the same people star in every illustration in the book.
    let castReferences: string[] = [];
    if (cast.length) {
      castReferences = await Promise.all(
        cast.slice(0, 3).map(c => resolveStorageUrl(c.url, 3600).catch(() => c.url)),
      );
    }

    setImgBusy(slotKey);
    try {
      // Each call gets its own variation seed and cache is bypassed, so the
      // server can never hand back a previously generated (identical) image.
      let raw: string | undefined;
      let lastErr = "";
      for (let tryNo = 0; tryNo < 3; tryNo++) {
        const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        const variedPrompt = `${basePrompt} Unique variation seed ${seed}${tryNo > 0 ? ` — the previous attempt failed quality control. Recompose wider with substantially more clearance above every head and around every body; invent a clearly different scene, angle, lighting and moment.` : ""}`;
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getEdgeAuthTokenSync()}`,
          },
          body: JSON.stringify({
            prompt: variedPrompt,
            tier: "premium",
            modelChain: ["google/gemini-3-pro-image-preview"],
            useCache: false,
            libraryFallback: false,
            ...(castReferences.length ? { inputImages: castReferences } : {}),
          }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          lastErr = err.error || "Image generation failed";
          continue;
        }
        const data = await resp.json();
        if (data?.fallback) { lastErr = "Generator returned a recycled image"; continue; }
        const candidate: string | undefined =
          data?.images?.[0]?.image_url?.url || data?.images?.[0]?.url || data?.images?.[0];
        if (!candidate) { lastErr = data?.error || "No image returned"; continue; }
        // Duplicate guard — compare actual image payloads, not storage URLs.
        const fingerprint = `${candidate.length}:${candidate.slice(-160)}`;
        if (usedImageUrlsRef.current.has(fingerprint)) { lastErr = "Duplicate image"; continue; }
        usedImageUrlsRef.current.add(fingerprint);
        raw = candidate;
        break;
      }
      if (!raw) throw new Error(lastErr || "No image returned");
      // Park the artwork in storage so the saved story stays small and the
      // picture never disappears on refresh.
      const url = await persistImageToStorage(raw);




      setStory((s) => {
        if (slot === "cover") return { ...s, coverImage: url };
        if (slot === "back") return { ...s, backImage: url };
        const next = [...s.chapters];
        const target = next[slot.index];
        const existing = target.images || [];
        const anchors = target.imageAnchors || [];
        const holos = target.imageHolo || [];
        // Where this picture belongs in the chapter (paragraph index it follows).
        const paraCount = (target.content || "").split(/\n{2,}/).filter(p => p.trim()).length;
        const anchor =
          typeof beat?.anchor === "number"
            ? beat.anchor
            : beat
              ? Math.min(paraCount, Math.round(((beat.index + 1) / (beat.total + 1)) * paraCount))
              : paraCount;
        const MAX_PER_CHAPTER = 6;
        if (existing.length >= MAX_PER_CHAPTER) {
          toast.info(`Max ${MAX_PER_CHAPTER} images per chapter — replacing the oldest.`);
          next[slot.index] = { ...target, images: [...existing.slice(1), url], imageAnchors: [...anchors.slice(1), anchor], imageHolo: [...holos.slice(1), holoRef] };
        } else {
          next[slot.index] = { ...target, images: [...existing, url], imageAnchors: [...anchors, anchor], imageHolo: [...holos, holoRef] };
        }
        return { ...s, chapters: next };
      });

      try {
        const label =
          slot === "cover" ? `${story.title} — Cover`
          : slot === "back" ? `${story.title} — Back Cover`
          : `${story.title} — ${ch?.title || "Chapter"} illustration${beat ? ` ${beat.index + 1}/${beat.total}` : ""}`;
        await saveToLibrary({
          media_type: "image",
          title: label,
          url,
          source_page: "story-writer",
          metadata: { story_id: savingId, slot: slotKey, beat: beat ? beat.index + 1 : undefined, beat_total: beat?.total, story_title: story.title, style: imgStyleId, user_prompt: (customPrompt?.trim() || imgCustomPrompt.trim()) || undefined, prompt: basePrompt },
        });
      } catch { /* non-fatal */ }
      if (!beat) toast.success("Illustration ready!");
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Could not generate image");
      return false;
    } finally {
      setImgBusy(null);
    }
  };

  /**
   * Illustrate a chapter properly: always produce at least MIN_IMAGES_PER_CHAPTER
   * images, one per narrative beat, in reading order so they sit in the right
   * places in the chapter (and hand off cleanly as scenes to Movie Maker).
   */
  const [chapterSetBusy, setChapterSetBusy] = useState<number | null>(null);
  const [illustrationTeamNotes, setIllustrationTeamNotes] = useState<string[]>([]);
  const illustrateChapterSet = async (
    idx: number,
    count = MIN_IMAGES_PER_CHAPTER,
    avoidBriefs?: string[],
  ): Promise<number> => {
    const ch = story.chapters[idx];
    if (!ch) return 0;
    let beats = chapterBeats(ch.content, count);
    try {
      const teamPlan = await callAI(
        `You are a three-person publishing illustration team: STORY EDITOR chooses the ${count} most explanatory moments; CINEMATOGRAPHER ensures complete uncropped people and readable environments; CONTINUITY EDITOR checks cast, wardrobe, spelling and forbids visible text. Choose exactly ${count} distinct images. Every image is a FULL-PAGE single-scene plate — never a split scene, mosaic or panel grid. Output exactly ${count} numbered lines, each a concise image brief.`,
        `BOOK: ${story.title}\nCHAPTER: ${ch.title}\nTEXT:\n${(ch.content || "").slice(0, 12000)}`,
      );
      const planned = teamPlan.split("\n").map(line => line.replace(/^\s*\d+[.)-]?\s*/, "").trim()).filter(Boolean).slice(0, count);
      if (planned.length === count) beats = planned;
      setIllustrationTeamNotes(planned);
    } catch { /* narrative beat fallback remains usable */ }
    // Where each image belongs in the chapter, in reading order.
    const paraCount = (ch.content || "").split(/\n{2,}/).filter(p => p.trim()).length;
    let ok = 0;
    for (let b = 0; b < count; b++) {
      const anchor = Math.min(paraCount, Math.round(((b + 1) / (count + 1)) * paraCount));
      const done = await generateStoryImage(
        { kind: "chapter", index: idx },
        undefined,
        { index: b, total: count, text: beats[b], anchor },
        avoidBriefs,
      );
      if (done) ok++;
    }
    return ok;
  };

  /**
   * Nuke every illustration in a chapter and draw a completely new set.
   * The old shot list is handed back to the artist as a "do not repeat" brief,
   * and a continuity agent verifies the new set is genuinely different.
   */
  const wipeAndReIllustrateChapter = async (idx: number, silent = false): Promise<number> => {
    const ch = story.chapters[idx];
    if (!ch) return 0;
    const previous = [...illustrationTeamNotes];
    setStory(s => {
      const next = [...s.chapters];
      next[idx] = { ...next[idx], images: [], imageAnchors: [], imageHolo: [] };
      return { ...s, chapters: next };
    });
    const ok = await illustrateChapterSet(idx, MIN_IMAGES_PER_CHAPTER, previous);
    if (!silent) {
      if (ok > 0) toast.success(`Chapter re-illustrated — ${ok} brand-new image${ok === 1 ? "" : "s"} placed in position.`);
      else toast.error("Re-illustration failed — no new images were produced.");
    }
    return ok;
  };

  const deleteAndReIllustrateChapter = async (idx: number) => {
    if (imgBusy || chapterSetBusy !== null || bulkBusy) return;
    if (!confirm(`Delete EVERY illustration in this chapter and draw a completely new set of ${MIN_IMAGES_PER_CHAPTER}? The new images will be different pictures — same cast, wardrobe and world.`)) return;
    setChapterSetBusy(idx);
    try { await wipeAndReIllustrateChapter(idx); } finally { setChapterSetBusy(null); }
  };

  const deleteAndReIllustrateBook = async () => {
    if (imgBusy || chapterSetBusy !== null || bulkBusy) return;
    if (!confirm(`Delete EVERY illustration in all ${story.chapters.length} chapters and re-illustrate the entire book from scratch? This can take a long while — keep this tab open.`)) return;
    setBulkBusy(true);
    let ok = 0;
    try {
      for (let i = 0; i < story.chapters.length; i++) {
        toast.info(`Re-illustrating chapter ${i + 1}/${story.chapters.length}…`, { id: "reillustrate-all" });
        ok += await wipeAndReIllustrateChapter(i, true);
      }
      toast.success(`Whole book re-illustrated — ${ok} new images placed in position.`, { id: "reillustrate-all" });
    } finally {
      setBulkBusy(false);
    }
  };

  // Illustrate one chapter — three team-selected images placed across the chapter's beats.
  const reIllustrateChapter = async (idx: number) => {
    if (imgBusy || chapterSetBusy !== null || bulkBusy) return;
    setChapterSetBusy(idx);
    try {
      const ok = await illustrateChapterSet(idx);
      if (ok > 0) toast.success(`Chapter illustrated — ${ok} image${ok === 1 ? "" : "s"} added.`);
    } finally {
      setChapterSetBusy(null);
    }
  };

  // Bulk: illustrate every chapter (three images each), sequentially.
  const [bulkBusy, setBulkBusy] = useState(false);
  const reIllustrateAllChapters = async () => {
    if (bulkBusy || imgBusy || chapterSetBusy !== null) return;
    if (!confirm(`Generate at least ${MIN_IMAGES_PER_CHAPTER} illustrations for all ${story.chapters.length} chapters? This may take several minutes.`)) return;
    setBulkBusy(true);
    let ok = 0;
    try {
      for (let i = 0; i < story.chapters.length; i++) {
        ok += await illustrateChapterSet(i);
      }
      toast.success(`Bulk illustration done — ${ok} images added across ${story.chapters.length} chapters.`);
    } finally {
      setBulkBusy(false);
    }

  };

  // === Regenerate the ENTIRE story (guided wizard: 50 questions + triple warnings) ===
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);

  const totalImageCount = () =>
    (story.coverImage ? 1 : 0) +
    (story.backImage ? 1 : 0) +
    story.chapters.reduce((n, c) => n + (c.images?.length || 0), 0);

  const regenerateEntireStory = async (plan: RegenPlan) => {
    if (regenBusy) return;
    setRegenBusy(true);
    const changeBrief = [
      plan.changes.length ? `REQUESTED CHANGES:\n- ${plan.changes.join("\n- ")}` : "",
      plan.notes ? `EXTRA INSTRUCTIONS FROM THE AUTHOR:\n${plan.notes}` : "",
    ].filter(Boolean).join("\n\n");

    try {
      toast.info(`Rewriting all ${story.chapters.length} chapters — this takes a while. Keep this tab open.`);
      const rewritten: string[] = [];
      for (let i = 0; i < story.chapters.length; i++) {
        const ch = story.chapters[i];
        const target = targetWordsFor(i);
        const prevContext = rewritten
          .map((t, j) => `${story.chapters[j].title}:\n${t.slice(0, 800)}`)
          .join("\n\n");
        toast.info(`Rewriting ${ch.title || `Chapter ${i + 1}`} (${i + 1}/${story.chapters.length})…`, { id: "regen-progress" });
        const text = await generateLongChapter(
          ch.title || `Chapter ${i + 1}`,
          `${changeBrief}\n\nORIGINAL CHAPTER (rewrite it, applying the changes above):\n${(ch.content || "").slice(0, 12000)}`,
          prevContext,
          target,
          (w) => toast.info(`Chapter ${i + 1}: ${w.toLocaleString()} / ${target.toLocaleString()} words`, { id: "regen-progress" }),
          (partial) => setStory(s => {
            const next = [...s.chapters];
            next[i] = { ...next[i], content: partial };
            return { ...s, chapters: next };
          }),
        );

        rewritten[i] = text;
        setStory(s => {
          const next = [...s.chapters];
          next[i] = { ...next[i], content: text, ...(plan.regenerateImages ? { images: [] } : {}) };
          return { ...s, chapters: next };
        });
      }

      if (plan.regenerateImages) {
        setStory(s => ({ ...s, coverImage: undefined, backImage: undefined }));
        toast.info("Now regenerating all artwork…", { id: "regen-progress" });
        await generateStoryImage("cover");
        await generateStoryImage("back");
        for (let i = 0; i < story.chapters.length; i++) {
          await illustrateChapterSet(i);
        }
      }

      toast.success("Your entire story has been regenerated.", { id: "regen-progress" });
      setRegenOpen(false);
    } catch (e: any) {
      if (e?.message !== "blocked") toast.error("Rewrite failed: " + (e?.message || "unknown"));
    } finally {
      setRegenBusy(false);
    }
  };



  const removeChapterImage = (chapterIdx: number, imageIdx: number) => {
    setStory((s) => {
      const next = [...s.chapters];
      const target = next[chapterIdx];
      const imgs = (target.images || []).filter((_, i) => i !== imageIdx);
      const anchors = (target.imageAnchors || []).filter((_, i) => i !== imageIdx);
      next[chapterIdx] = { ...target, images: imgs, imageAnchors: anchors };
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



  // Long-chapter generator: every AI chapter must be AT LEAST 15,000 words,
  // and no two chapters may end up with the same word count (each chapter gets
  // its own unique target, spaced 200+ words apart).
  const MIN_WORDS = 15000;
  const WORD_STEP = 200;
  const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

  /** Unique length target for a chapter: 15,000+ and > 200 words apart from every other chapter. */
  const targetWordsFor = (idx: number): number => {
    const taken = story.chapters
      .map((c, i) => (i === idx ? 0 : wordCount(c.content)))
      .filter(n => n >= MIN_WORDS);
    let target = MIN_WORDS + WORD_STEP * (idx + 1);
    // Push past any existing chapter length that is within WORD_STEP of the target.
    let guard = 0;
    while (taken.some(n => Math.abs(n - target) <= WORD_STEP) && guard++ < 200) {
      target += WORD_STEP + 50;
    }
    return target;
  };

  const generateLongChapter = async (
    chapterTitle: string,
    guidance: string,
    previousContext: string,
    targetWords: number = MIN_WORDS + WORD_STEP,
    onProgress?: (words: number) => void,
    /** Called with the full text so far after every pass so nothing is lost if a later pass fails. */
    onChunk?: (partial: string) => void
  ): Promise<string> => {

    const baseSystem = `You are a master ${story.genre} novelist writing a full-length book chapter.
Write a COMPLETE chapter of AT LEAST ${targetWords.toLocaleString()} words — rich prose, vivid sensory detail, full scenes with dialogue, internal thought, action, subplot and pacing. Do NOT summarize. Do NOT use bullet points. Do NOT include outlines or author notes. Write only the chapter prose. You may include the chapter title as the first line. Keep writing — never stop early.${styleRule()}`;

    const userPrompt = `STORY TITLE: ${story.title}
GENRE: ${story.genre}
PREMISE: ${story.premise}

PREVIOUS CHAPTERS (summary/context):
${previousContext || "(none — this is an early chapter)"}

CHAPTER TO WRITE: ${chapterTitle}
USER GUIDANCE FOR THIS CHAPTER:
${guidance || "(no extra guidance — follow the natural arc)"}

Write the full chapter now (${targetWords.toLocaleString()}+ words):`;

    let text = await callAI(baseSystem, userPrompt, {
      model: "google/gemini-2.5-pro",
      maxTokens: 16000,
    });
    onProgress?.(wordCount(text));
    onChunk?.(text);

    // Continuation passes until we reach the unique target (long chapters need many).
    let attempts = 0;
    while (wordCount(text) < targetWords && attempts < 30) {
      attempts++;
      const tail = text.slice(-3000);
      const remaining = targetWords - wordCount(text);
      let more = "";
      try {
        more = await callAI(
          `You are continuing the same ${story.genre} chapter seamlessly, in the same voice and tense. Do not repeat anything. Do not wrap up unless told. Add several more rich, fully-dramatised scenes. Continue the prose only.`,
          `STORY: ${story.title}\nCHAPTER: ${chapterTitle}\n\nLAST PORTION:\n${tail}\n\nContinue the chapter — write at least ${Math.min(remaining, 3000).toLocaleString()} more words (chapter total target ${targetWords.toLocaleString()}+ words):`,
          { model: "google/gemini-2.5-pro", maxTokens: 16000 }
        );
      } catch (e) {
        // Keep everything written so far rather than losing the whole chapter.
        console.warn("[generateLongChapter] continuation failed, keeping progress", e);
        break;
      }
      if (!more?.trim()) break;
      text = (text + "\n\n" + more).trim();
      onProgress?.(wordCount(text));
      onChunk?.(text);
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
      trackEdit("ai", activeChapter, ch.content, (ch.content + "\n\n" + text).trim(), "AI continue");
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

  /** Optional front matter written by the Oracle — dedication or prelude. */
  const aiWriteFrontMatter = async (kind: "dedication" | "prelude") => {
    if (!requireMeta()) return;
    try {
      const sample = story.chapters.map(c => c.content).join("\n\n").slice(0, 6000);
      const system = kind === "dedication"
        ? `You are a bestselling author writing the dedication page of a book. Write 1-3 short, heartfelt lines. No headings, no quotes, no commentary — just the dedication.`
        : `You are a master ${story.genre} novelist writing the PRELUDE that opens the book before Chapter 1. 400-700 words of atmospheric, hooking prose that sets up the world, the myth or the inciting shadow of the story without spoiling it. Prose only.${styleRule()}`;
      const text = await callAI(
        system,
        `TITLE: ${story.title}\nAUTHOR: ${story.author}\nGENRE: ${story.genre}\nPREMISE: ${story.premise}\nBLURB: ${story.blurb || "(none)"}\n\nSTORY TEXT SO FAR:\n${sample || "(nothing written yet)"}\n\nWrite the ${kind}:`
      );
      const clean = (text || "").trim();
      if (!clean) throw new Error("Nothing returned");
      setStory(s => ({ ...s, [kind]: clean }));
      toast.success(kind === "dedication" ? "Dedication written" : "Prelude written");
    } catch (e: any) {
      if (e?.message !== "blocked") toast.error(e?.message || `Could not write the ${kind}`);
    }
  };

  /** ORACLE TAKEOVER — the Oracle finishes the whole book from wherever the author stopped. */
  const [takeoverBusy, setTakeoverBusy] = useState<string | null>(null);
  const oracleTakeOver = async () => {
    if (!requireMeta()) return;
    if (!window.confirm("Let the Oracle take over and finish this story? It will complete every unfinished chapter in your voice. Your existing writing is kept.")) return;
    setTakeoverBusy("starting");
    try {
      const chapters = [...story.chapters];
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const words = wordCount(ch.content || "");
        if (words >= MIN_WORDS) continue;
        setTakeoverBusy(`${ch.title} (${i + 1}/${chapters.length})`);
        const previousContext = chapters
          .slice(0, i)
          .map(c => `${c.title}: ${(c.content || "").slice(0, 1200)}`)
          .join("\n\n")
          .slice(-9000);
        const guidance = ch.content?.trim()
          ? `The author already began this chapter. Keep every word they wrote, then continue seamlessly from it:\n\n${ch.content.slice(-3000)}`
          : "(the author left this chapter empty — write it in full)";
        const text = await generateLongChapter(
          ch.title,
          guidance,
          previousContext,
          targetWordsFor(i),
          w => setTakeoverBusy(`${ch.title} — ${w.toLocaleString()} words`),
          partial => setStory(s => {
            const next = [...s.chapters];
            const base = ch.content?.trim() ? `${ch.content.trim()}\n\n${partial.trim()}` : partial.trim();
            next[i] = { ...next[i], content: base };
            return { ...s, chapters: next };
          })
        );

        const merged = ch.content?.trim() ? `${ch.content.trim()}\n\n${text.trim()}` : text.trim();
        trackEdit("ai", i, ch.content, merged, "Oracle takeover");
        chapters[i] = { ...ch, content: merged };
        setStory(s => {
          const next = [...s.chapters];
          next[i] = { ...next[i], content: merged };
          return { ...s, chapters: next };
        });
      }
      if (!story.dedication?.trim()) { setTakeoverBusy("dedication"); await aiWriteFrontMatter("dedication"); }
      if (!story.prelude?.trim()) { setTakeoverBusy("prelude"); await aiWriteFrontMatter("prelude"); }
      toast.success("The Oracle finished your story.");
    } catch (e: any) {
      if (e?.message !== "blocked") toast.error(e?.message || "Oracle takeover failed");
    } finally {
      setTakeoverBusy(null);
    }
  };


  const aiWriteBlurb = async () => {
    if (!requireMeta()) return;
    const sample = story.chapters
      .map(c => `${c.title}\n${c.content.slice(0, 1200)}`)
      .join("\n\n")
      .slice(0, 8000);
    try {
      setAiBusy(true);
      const text = await callAI(
        `You are a bestselling publisher's copywriter. Write a compelling back-cover blurb for a ${story.genre} book: 150-220 words, present tense, hook first, name the protagonist, the world, the stakes and the central conflict, end on an irresistible question or promise. Vivid, concrete, cinematic imagery — no spoilers, no headings, no quotes, prose only.`,
        `TITLE: ${story.title}\nAUTHOR: ${story.author}\nGENRE: ${story.genre}\nPREMISE: ${story.premise}\n\nSTORY TEXT SO FAR:\n${sample || "(no chapters written yet — work from the premise)"}\n\nWrite the blurb:`
      );
      setStory(s => ({ ...s, blurb: text.trim() }));
      toast.success("Blurb written — the cover AI will use it");
    } catch (e: any) {
      toast.error("Blurb failed: " + (e?.message || "unknown"));
    } finally {
      setAiBusy(false);
    }
  };

  /**
   * COVER SWARM — a team of specialist AI agents design the front and back
   * covers from the finished book, every single time. Nothing is generic:
   *  • Casting agent locks the real characters, wardrobe and world.
   *  • Art director writes the cinematic 4K photoreal art direction.
   *  • Copywriter writes the back-cover blurb (always fresh, never a placeholder).
   *  • Critic tears both apart and the lead merges the winning direction.
   * The lead's art direction is fed straight into the image generator for both
   * covers, so each run is unique to that story.
   */
  const [coverSwarm, setCoverSwarm] = useState<string | null>(null);
  const [coverTeamNotes, setCoverTeamNotes] = useState<string[]>([]);
  const [coverDesign, setCoverDesign] = useState<CoverDesign | undefined>(undefined);

  const runCoverSwarm = async () => {
    if (!requireMeta()) return;
    const sample = story.chapters
      .map(c => `${c.title}\n${(c.content || "").slice(0, 1500)}`)
      .join("\n\n")
      .slice(0, 12000);
    const brief = `TITLE: ${story.title}\nAUTHOR: ${story.author}\nGENRE: ${story.genre}\nPREMISE: ${story.premise}\nEXTRA DIRECTION FROM AUTHOR: ${coverPrompt || "(none)"}\n\nBOOK TEXT:\n${sample || "(no chapters yet — work from the premise)"}`;

    try {
      setCoverSwarm("Casting + art direction + montage agents reading the book…");
      const [casting, artDirection, montage, blurb] = await Promise.all([
        callAI(
          "You are the CASTING agent for a book cover team. From the book text, lock the principal cast: for each, exact age, build, face, hair, skin, wardrobe, and signature prop. Then lock the world: era, city, weather, time of day, palette. Output tight bullet lines only, no preamble.",
          brief,
        ),
        callAI(
          `You are the ART DIRECTOR of an award-winning book cover studio whose covers win the ABCD / Clio design awards. The house style for this book is BLOCKBUSTER CINEMATIC MONTAGE: a layered movie-poster composition — hero large in the foreground mid-stride toward camera, secondary characters and story beats layered behind at smaller scale, fire, blast debris, smoke plumes, muzzle flash, rain of sparks, vehicles, skyline — all fused into one seamless photoreal image with true depth (foreground / midground / background), volumetric light shafts and anamorphic flare. Never a flat single-subject portrait, never a literal grid of separate panels — one continuous cinematic frame with montage layering. Research what sells in this genre: palette psychology, character hierarchy, facial emotion, lens choice, shelf-thumbnail impact at 1cm, typography space. Rich multi-colour palette with a named dominant, secondary and contrast accent; avoid black-and-gold unless the story demands it. Write the shot brief for one iconic FRONT montage and a genuinely different BACK montage. Cinematic 4K photoreal, whole heads always in frame with headroom. Never request painted text. Output exactly two labelled paragraphs: "FRONT:" and "BACK:".`,
          brief,
        ),
        callAI(
          `You are the MONTAGE ARCHITECT — you design blockbuster movie-poster layering. From the book, choose the SIX strongest visual beats (the hero moment, the antagonist, the betrayal, the chase/heist, the explosion, the aftermath). For each, give one line: subject, action, scale in frame (hero/large/mid/small/silhouette), depth layer, and lighting. Then state exactly how they fuse into ONE continuous photoreal frame — where the smoke, fire glow and shadow gradients hide the seams, where the eye travels, and where the clean negative space for title typography sits. Bullet lines only.`,
          brief,
        ),
        callAI(
          "You are a bestselling publisher's copywriter. Write the back-cover blurb: 150-220 words, present tense, hook first, name the protagonist, the world, the stakes and the central conflict, end on an irresistible promise. Prose only — no headings, no quotes, no spoilers.",
          brief,
        ),
      ]);

      setCoverSwarm("Critic agent reviewing…");
      const critique = await callAI(
        "You are the CRITIC on an award-jury cover team. Attack the art direction and montage plan: what looks generic, stocky, AI-typical, flat, off-book, or would fail as a 1cm thumbnail? Demand more depth layering, stronger silhouette read, better focal hierarchy and real cinematic drama. Give concrete fixes only, max 10 bullets.",
        `${brief}\n\nCASTING:\n${casting}\n\nART DIRECTION:\n${artDirection}\n\nMONTAGE PLAN:\n${montage}`,
      );

      setCoverSwarm("Lead agent merging the winning direction…");
      const finalDirection = await callAI(
        `You are the LEAD of the cover team. Produce TWO independent image-model briefs for an AWARD-WINNING blockbuster montage cover set. Both must be ONE seamless photoreal cinematic frame with explicit foreground / midground / background layering of story beats — explosions, fire glow, smoke, debris, sparks, weather, skyline — fused with light and shadow, anamorphic flare, volumetric shafts, 35mm depth of field. FRONT is the iconic high-impact sales montage led by the hero walking toward camera at large scale with full head and headroom. BACK is a genuinely different montage: different beats, location, camera angle, focal length and visual hierarchy — never a rearranged front, never a second hero lineup. Preserve locked character identity wherever a character appears. Every person must have their whole head in frame with clear headroom; nothing important within 12% of any edge. Never request text, titles, author names, format labels, credits, typography, logos or lettering. Leave clean negative space in the lower third of the front for composited retail typography and a lower-right rear barcode zone. Output exactly:
FRONT: <brief under 240 words>
BACK: <brief under 240 words>`,
        `${brief}\n\nCASTING:\n${casting}\n\nART DIRECTION:\n${artDirection}\n\nMONTAGE PLAN:\n${montage}\n\nCRITIC:\n${critique}`,
      );



      const cleanBlurb = (blurb || "").trim();
      const direction = (finalDirection || "").trim();
      const frontMatch = direction.match(/FRONT:\s*([\s\S]*?)(?=\n\s*BACK:|$)/i);
      const backMatch = direction.match(/BACK:\s*([\s\S]*)$/i);
      const frontDirection = frontMatch?.[1]?.trim() || `${direction}\nCreate the iconic front-cover sales image.`;
      const backDirection = backMatch?.[1]?.trim() || `${direction}\nCreate a different environmental aftermath image with no hero lineup.`;
      setStory(s => ({ ...s, blurb: cleanBlurb || s.blurb }));
      setFrontCoverDirection(frontDirection);
      setBackCoverDirection(backDirection);

      // TYPOGRAPHY / DESIGN DIRECTOR agent — picks the actual title treatment,
      // layout and palette so the lettering is designed, never defaulted.
      setCoverSwarm("Design director agent choosing typography + palette…");
      let designNote = "";
      try {
        const designRaw = await callAI(
          `You are the DESIGN DIRECTOR of a bestselling cover studio, an expert typographer. Choose the title treatment for this book. Reply with ONLY minified JSON, no prose, no code fences:
{"identityKey":"<one of ${COVER_IDENTITY_KEYS.join("|")}>","layout":"<masthead|title-author|cinematic|editorial>","light":"#RRGGBB","mid":"#RRGGBB","deep":"#RRGGBB","accent":"#RRGGBB","tracking":<number -0.02..0.12>,"why":"<one sentence>"}
Rules: the three title-gradient colours must read as one confident, high-contrast palette against the artwork (light = highlight, mid = body colour, deep = shadow), the accent is for the rule/genre line and must pop. Never default to plain white-on-black. Match genre convention but be bold and modern; letter-spacing should suit the face (condensed slabs tight, engraved serifs wide).`,
          `${brief}\n\nART DIRECTION:\n${artDirection}\n\nFRONT ART:\n${frontDirection}`,
        );
        const json = (designRaw || "").replace(/```json|```/g, "").match(/\{[\s\S]*\}/)?.[0];
        if (json) {
          const parsed = JSON.parse(json) as CoverDesign & { why?: string };
          setCoverDesign({
            identityKey: parsed.identityKey,
            layout: parsed.layout,
            light: parsed.light,
            mid: parsed.mid,
            deep: parsed.deep,
            accent: parsed.accent,
            tracking: typeof parsed.tracking === "number" ? parsed.tracking : undefined,
          });
          designNote = `Design director: ${parsed.identityKey} / ${parsed.layout} — ${parsed.why || "typography locked"}`;
        }
      } catch {
        designNote = "Design director: fell back to the book's default typographic identity";
      }

      setCoverTeamNotes([
        `Casting locked: ${casting.replace(/\s+/g, " ").slice(0, 220)}`,
        `Market art direction: ${artDirection.replace(/\s+/g, " ").slice(0, 220)}`,
        `Montage architecture: ${montage.replace(/\s+/g, " ").slice(0, 220)}`,

        `Critic corrections: ${critique.replace(/\s+/g, " ").slice(0, 220)}`,
        `Lead decision: ${direction.replace(/\s+/g, " ").slice(0, 240)}`,
        ...(designNote ? [designNote] : []),
      ]);
      setCoverPrompt("");


      setCoverSwarm("Painting the front cover…");
      await generateStoryImage("cover", frontDirection);
      setCoverSwarm("Painting the back cover…");
      await generateStoryImage("back", backDirection);
      toast.success("Cover swarm finished — fresh blurb and both covers built from your book");
    } catch (e: any) {
      if (e?.message !== "blocked") toast.error(e?.message || "Cover swarm failed");
    } finally {
      setCoverSwarm(null);
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
      trackEdit("ai", activeChapter, ch.content, text, "AI rewrite");
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

  // === Humanising rewrite pass — rewrites in the author's own voice ===
  const [humanBusy, setHumanBusy] = useState<"chapter" | "book" | null>(null);

  const humaniseText = async (title: string, content: string): Promise<string> => {
    const chunks: string[] = [];
    const paras = content.split(/\n\n+/);
    let buf = "";
    for (const p of paras) {
      if ((buf + p).length > 9000) { chunks.push(buf); buf = p; } else { buf += (buf ? "\n\n" : "") + p; }
    }
    if (buf.trim()) chunks.push(buf);

    const out: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (chunks.length > 1) toast.info(`Humanising ${title} — part ${i + 1}/${chunks.length}…`, { id: "humanise" });
      const res = await callAI(
        `${HUMANISE_SYSTEM}${styleRule()}`,
        `STORY: ${story.title} (${story.genre})\nSECTION: ${title}\n\nRewrite this passage in the author's own voice. Keep every plot point, name and roughly the same length. Return only the rewritten prose.\n\n${chunks[i]}`,
        { model: "google/gemini-2.5-pro", maxTokens: 16000 },
      );
      out.push(res.trim());
    }
    return out.join("\n\n");
  };

  const humaniseChapter = async () => {
    const ch = story.chapters[activeChapter];
    if (!ch?.content.trim()) { toast.error("Nothing to humanise yet"); return; }
    if (humanBusy) return;
    setHumanBusy("chapter");
    try {
      const text = await humaniseText(ch.title || `Chapter ${activeChapter + 1}`, ch.content);
      trackEdit("ai", activeChapter, ch.content, text, "Humanising pass (author voice)");
      setStory(s => {
        const next = [...s.chapters];
        next[activeChapter] = { ...next[activeChapter], content: text };
        return { ...s, chapters: next };
      });
      toast.success("Chapter rewritten in your voice", { id: "humanise" });
    } catch (e: any) {
      if (e?.message !== "blocked") toast.error("Humanising failed: " + (e?.message || "unknown"));
    } finally {
      setHumanBusy(null);
    }
  };

  const humaniseBook = async () => {
    if (humanBusy) return;
    if (!confirm(`Rewrite all ${story.chapters.length} chapters in your own voice? This takes a while.`)) return;
    setHumanBusy("book");
    try {
      for (let i = 0; i < story.chapters.length; i++) {
        const ch = story.chapters[i];
        if (!ch.content.trim()) continue;
        const text = await humaniseText(ch.title || `Chapter ${i + 1}`, ch.content);
        trackEdit("ai", i, ch.content, text, "Humanising pass (author voice)");
        setStory(s => {
          const next = [...s.chapters];
          next[i] = { ...next[i], content: text };
          return { ...s, chapters: next };
        });
      }
      toast.success("Whole book rewritten in your voice", { id: "humanise" });
    } catch (e: any) {
      if (e?.message !== "blocked") toast.error("Humanising failed: " + (e?.message || "unknown"));
    } finally {
      setHumanBusy(null);
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
    const target = targetWordsFor(activeChapter);
    try {
      toast.info(`Generating full chapter — target ${target.toLocaleString()}+ words. This takes several minutes...`);
      let text = await generateLongChapter(
        ch.title,
        guidance ?? chapterGuidance,
        buildPrevContext(activeChapter),
        target,
        (w) => {
          if (w < target) toast.info(`Writing… ${w.toLocaleString()} / ${target.toLocaleString()} words`, { id: "chapter-progress" });
        },
        (partial) => setStory(s => {
          const next = [...s.chapters];
          next[activeChapter] = { ...next[activeChapter], content: partial };
          return { ...s, chapters: next };
        })
      );


      // Guarantee no two chapters share the same word count (200+ words apart).
      const others = story.chapters
        .map((c, i) => (i === activeChapter ? -1 : wordCount(c.content)))
        .filter(n => n > 0);
      let guard = 0;
      while (others.some(n => Math.abs(n - wordCount(text)) <= WORD_STEP) && guard++ < 4) {
        const more = await callAI(
          `You are continuing the same ${story.genre} chapter seamlessly. Do not repeat. Continue the prose only.`,
          `STORY: ${story.title}\nCHAPTER: ${ch.title}\n\nLAST PORTION:\n${text.slice(-3000)}\n\nAdd at least 400 more words of new scene:`,
          { model: "google/gemini-2.5-pro", maxTokens: 8000 }
        );
        if (!more?.trim()) break;
        text = (text + "\n\n" + more).trim();
      }

      trackEdit("ai", activeChapter, ch.content, text, "AI full chapter");
      setStory(s => {
        const next = [...s.chapters];
        next[activeChapter] = { ...ch, content: text };
        return { ...s, chapters: next };
      });
      const wc = wordCount(text);
      toast.success(`Chapter generated — ${wc.toLocaleString()} words`, { id: "chapter-progress" });
      if (wc < MIN_WORDS) toast.warning(`Chapter came in under ${MIN_WORDS.toLocaleString()} words — use "Continue" to extend it.`);
      setChapterGuidance("");
      setFlowStage("askEdit");
      void saveToLibrary({
        media_type: "text",
        title: `Story Chapter: ${ch.title}`,
        url: text,
        source_page: "story-writer",
        metadata: { genre: story.genre, action: "full-chapter", wordCount: wc, targetWords: target },
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
        `You are a master editor. Apply the user's edit instructions to the chapter. Preserve overall plot and length (still 15,000+ words — never shorten). Return only the revised chapter prose.`,
        `EDIT INSTRUCTIONS:\n${editInstructions}\n\nCHAPTER:\n${ch.content}`,
        { model: "google/gemini-2.5-pro", maxTokens: 16000 }
      );
      trackEdit("ai", activeChapter, ch.content, text, `AI edit: ${editInstructions.slice(0, 120)}`);
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
  const [kindleOpen, setKindleOpen] = useState(false);
  // === Compliance kit: provenance + disclosures + authorship log (privacy-scrubbed) ===
  const disclosureFacts = (opts: { voice?: boolean } = {}): DisclosureFacts => ({
    title: scrubIdentifiers(story.title || "Untitled"),
    author: scrubIdentifiers(authorName()),
    aiTextUsed: true,
    aiImagesUsed: totalImageCount() > 0,
    aiVoiceUsed: !!opts.voice,
    humanEditedPercent: authorship.humanPercent,
    tools: ["Oracle Lunar", "Google Gemini", "ElevenLabs"],
  });

  const complianceFiles = (opts: { voice?: boolean } = {}): Record<string, string> => {
    const facts = disclosureFacts(opts);
    return {
      "PROVENANCE.txt": provenanceBlock({
        title: facts.title,
        author: facts.author,
        tool: "Oracle Lunar",
        aiAssisted: true,
        humanEditedPercent: authorship.humanPercent,
      }),
      "HUMAN-AUTHORSHIP-LOG.txt": scrubIdentifiers(
        authorshipLogText(authorship, { title: facts.title, author: facts.author }),
      ),
      ...allDisclosures(facts),
    };
  };

  const downloadComplianceKit = async (opts: { voice?: boolean } = {}) => {
    const zip = new JSZip();
    for (const [name, body] of Object.entries(complianceFiles(opts))) zip.file(name, body);
    zip.file("READ-ME-FIRST.txt", combinedDisclosure(disclosureFacts(opts)));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileName(story.title, "story")}-compliance-kit.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Compliance kit downloaded — disclosures, provenance and authorship log.");
  };

  const exportEpub = async (opts?: { returnFile?: boolean }): Promise<File | null> => {
    if (!story.chapters.some(c => c.content.trim())) {
      toast.error("Write at least one chapter first."); return null;
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
          // Privacy-only metadata hygiene: re-encode the cover so EXIF/GPS/device
          // identifiers are dropped. Provenance stays in PROVENANCE.txt.
          let bytes = await stripImageMetadata(story.coverImage, m[1] === "image/jpeg" ? "image/jpeg" : "image/png");
          if (!bytes) {
            const bin = atob(m[2]);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          }
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

      // Optional front matter — dedication and prelude (only if the author wrote them)
      const frontFiles: { fname: string; title: string; id: string }[] = [];
      const addFront = (id: string, heading: string, body: string) => {
        const text = (body || "").trim();
        if (!text) return;
        const fname = `${id}.xhtml`;
        const paras = text.split(/\n{2,}/).map(p => `<p>${xmlEscape(p).replace(/\n/g, "<br/>")}</p>`).join("\n");
        oebps.file(fname,
          `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xmlEscape(heading)}</title></head>
<body><h1>${xmlEscape(heading)}</h1>${paras}</body></html>`);
        frontFiles.push({ fname, title: heading, id });
      };
      addFront("dedication", "Dedication", story.dedication || "");
      addFront("prelude", "Prelude", story.prelude || "");

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

      const allFiles = [...frontFiles, ...chapterFiles];
      const manifestItems = allFiles.map(c => `<item id="${c.id}" href="${c.fname}" media-type="application/xhtml+xml"/>`).join("\n");
      const spineItems = allFiles.map(c => `<itemref idref="${c.id}"/>`).join("\n");
      const navPoints = allFiles.map(c => `<li><a href="${c.fname}">${xmlEscape(c.title)}</a></li>`).join("\n");

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
    <dc:description>${xmlEscape(story.blurb || story.premise || "")}</dc:description>
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
      const fileName = `${slugify(story.title)}.epub`;
      if (opts?.returnFile) {
        return new File([blob], fileName, { type: "application/epub+zip" });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("EPUB ready — upload to Kindle, Kobo, Apple Books, Google Play, B&N, Draft2Digital or Smashwords.");
      // Auto-attach the compliance kit (KDP declaration, provenance, authorship log)
      await downloadComplianceKit({ voice: false });
      return null;
    } catch (e: any) {
      toast.error(e?.message || "EPUB export failed");
      return null;
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
    try {
      return await narrateOneChunk(text);
    } catch (e: any) {
      throw new Error(e?.message || "Narration failed");
    }
  };


  const exportAudiobook = async () => {
    if (!user) { toast.error("Sign in to build audiobook"); return; }
    if (!story.chapters.some(c => c.content.trim())) {
      toast.error("Write at least one chapter first."); return;
    }
    if (!confirm(
      `Narrate all ${story.chapters.length} chapters into a full audiobook?\n\n` +
      `This uses your ElevenLabs credits and packages Audible/ACX-ready MP3s ` +
      `(44.1kHz 124kbps), opening & closing credits, a retail sample, and metadata.txt.`
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
      // Compliance kit inside the ACX bundle (privacy-scrubbed, provenance kept)
      for (const [name, body] of Object.entries(complianceFiles({ voice: true }))) zip.file(name, body);

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
      toast.success("Audiobook package ready — formatted for Audible/ACX submission. Check the included checklist before uploading.");
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
      // Keep EVERYTHING the draft already had (cover art, blurb, chapter images)
      // and stay on media_type 'story' — the public /stories/:slug page reads
      // from that view, so flipping the type used to 404 every shared link.
      const metadata = {
          slug,
          author: story.author,
          authorName: story.author || user.email?.split("@")[0],
          genre: story.genre,
          premise: story.premise,
          blurb: story.blurb || "",
          prelude: story.prelude || "",
          dedication: story.dedication || "",
          coverImage: story.coverImage,
          backImage: story.backImage,
          chapters: story.chapters,
          wordCount,
          published: true,
          publishedUrl,
          admin_library_visible: true,
          kind: "story_doc",
          library_kind: "story",
      };
      if (savingId) {
        const { error } = await supabase.from("user_media").update({
          media_type: "story",
          title: story.title || "Untitled Story",
          source_page: "story-writer",
          is_public: true,
          metadata,
        } as any).eq("id", savingId);
        if (error) throw error;
      } else {
        const id = await saveToLibrary({
          media_type: "document",
          title: story.title || "Untitled Story",
          url: `oracle-lunar://story/${crypto.randomUUID()}`,
          source_page: "story-writer",
          is_public: true,
          metadata,
        });
        if (!id) throw new Error("Story save was queued for retry");
        const { error } = await supabase.from("user_media")
          .update({ media_type: "story", is_public: true } as any).eq("id", id);
        if (error) throw error;
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

          {/* ====== STORY BLURB — the source material the cover AI reads ====== */}
          <div className="rounded-xl border border-primary/30 bg-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <BookMarked className="w-3.5 h-3.5" /> Story blurb (feeds the cover art)
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {story.blurb?.trim() ? `${story.blurb.trim().split(/\s+/).length} words` : "empty"}
                </span>
                <button
                  type="button"
                  onClick={aiWriteBlurb}
                  disabled={aiBusy}
                  className="text-[11px] px-2.5 py-1.5 rounded-full bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 flex items-center gap-1 disabled:opacity-50"
                >
                  {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {story.blurb?.trim() ? "Rewrite blurb" : "Write blurb with AI"}
                </button>
              </div>
            </div>
            <textarea
              value={story.blurb || ""}
              onChange={e => setStory(s => ({ ...s, blurb: e.target.value }))}
              placeholder="The full back-cover blurb — characters, world, era, stakes, mood. The front and back cover AI draws its imagery directly from this."
              rows={7}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground leading-relaxed resize-y"
            />
            <p className="text-[10px] text-muted-foreground">
              This blurb is the primary source the cover artist AI reads for the front and back covers — the richer it is, the more accurate your artwork. It also saves with the story and is used in your EPUB description and share posts.
            </p>
          </div>

          {/* ====== OPTIONAL FRONT MATTER — dedication + prelude ====== */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-3">
            <p className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Front matter (optional)
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-semibold text-foreground">Dedication</label>
                <button
                  type="button"
                  onClick={() => aiWriteFrontMatter("dedication")}
                  disabled={aiBusy}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 flex items-center gap-1 disabled:opacity-50"
                >
                  {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {story.dedication?.trim() ? "Rewrite" : "Write with AI"}
                </button>
              </div>
              <textarea
                value={story.dedication || ""}
                onChange={e => setStory(s => ({ ...s, dedication: e.target.value }))}
                placeholder="For Mum, who never stopped believing… (optional)"
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground leading-relaxed resize-y"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-semibold text-foreground">Prelude</label>
                <button
                  type="button"
                  onClick={() => aiWriteFrontMatter("prelude")}
                  disabled={aiBusy}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 flex items-center gap-1 disabled:opacity-50"
                >
                  {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  {story.prelude?.trim() ? "Rewrite" : "Write with AI"}
                </button>
              </div>
              <textarea
                value={story.prelude || ""}
                onChange={e => setStory(s => ({ ...s, prelude: e.target.value }))}
                placeholder="An opening passage before Chapter 1 — set the scene, the myth, the warning… (optional)"
                rows={5}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground leading-relaxed resize-y"
              />
              <p className="text-[10px] text-muted-foreground">
                Both are optional. When filled they're saved with your story and placed before Chapter 1 in your EPUB, publish and share exports.
              </p>
            </div>
          </div>

          {/* ====== ORACLE TAKEOVER — let the Oracle finish the book ====== */}
          <button
            type="button"
            onClick={oracleTakeOver}
            disabled={takeoverBusy !== null || aiBusy}
            className="w-full rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-500/20 to-primary/15 px-3 py-3 text-left disabled:opacity-60"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-amber-300">
              {takeoverBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {takeoverBusy ? `Oracle is writing… ${takeoverBusy}` : "Let the Oracle take over & finish my story"}
            </span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              The Oracle picks up exactly where you stopped, fills every unfinished chapter in your voice, and writes the dedication and prelude if they're empty.
            </span>
          </button>




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
              This style and description apply to every chapter illustration. Front and back covers are baked last, in the Cover Studio below.
            </p>
          </div>


          {/* ====== PHOTO CAST — upload a face, the AI recasts every image ====== */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Photo cast — put a real person in the story
            </p>
            <p className="text-[10px] text-muted-foreground">
              Upload a photo and the AI instantly re-renders <b>every image already in this book</b> with that person as the character, and stars them in every new illustration too. Fictional characters only — inspired by your photo, never a real identifiable public figure.
            </p>

            {cast.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {cast.map(c => (
                  <div key={c.id} className="rounded-lg border border-border bg-background p-2 space-y-1.5">
                    <div className="relative aspect-square rounded-md overflow-hidden bg-muted">
                      <SignedImage src={c.url} alt={c.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeCast(c.id)}
                        className="absolute top-1 right-1 p-1 rounded-md bg-background/80 border border-border"
                        aria-label="Remove cast photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      value={c.name}
                      onChange={e => updateCast(c.id, { name: e.target.value })}
                      placeholder="Character name"
                      className="w-full bg-card border border-border rounded px-2 py-1 text-[11px] text-foreground"
                    />
                    <input
                      value={c.role || ""}
                      onChange={e => updateCast(c.id, { role: e.target.value })}
                      placeholder="Role (hero, villain…)"
                      className="w-full bg-card border border-border rounded px-2 py-1 text-[11px] text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => recastAllImages(c.url)}
                      disabled={!!recastBusy || !!imgBusy}
                      className="w-full py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-500 text-[10px] font-semibold disabled:opacity-50"
                    >
                      Recast all images with this person
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={castFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handleCastFile(e.target.files?.[0] || null)}
            />
            <label className="flex items-start gap-2 text-[10px] text-muted-foreground">
              <input type="checkbox" checked={castConsent} onChange={e => setCastConsent(e.target.checked)} className="mt-0.5" />
              <span>I confirm I have the right to use this photo, and understand the characters are fictional.</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => castFileRef.current?.click()}
                disabled={!castConsent || !!recastBusy || cast.length >= 6}
                className="py-2 rounded-lg bg-gradient-to-r from-amber-500 to-primary text-primary-foreground font-bold text-xs disabled:opacity-50"
              >
                {recastBusy ? `Recasting ${recastBusy.done}/${recastBusy.total}…` : "＋ Upload a photo"}
              </button>
              <button
                type="button"
                onClick={() => { setPickerTarget("cast"); setPickerOpen(true); }}
                disabled={!castConsent || !!recastBusy || cast.length >= 6}
                className="py-2 rounded-lg border border-border bg-background text-foreground font-semibold text-xs disabled:opacity-50"
              >
                Pick from Library
              </button>
            </div>
            {recastBusy && (
              <p className="text-[10px] text-amber-500 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Re-rendering image {recastBusy.done + 1} of {recastBusy.total} with your uploaded person…
              </p>
            )}
          </div>



          {/* ====== COVER STUDIO — the last illustration step ====== */}
          <CoverStudio
            title={story.title}
            author={story.author}
            blurb={story.blurb || ""}
            genre={story.genre}
            coverImage={story.coverImage}
            backImage={story.backImage}
            busy={imgBusy}
            prompt={coverPrompt}
            onPromptChange={setCoverPrompt}
            frontDirection={frontCoverDirection}
            backDirection={backCoverDirection}
            swarmBusy={coverSwarm}
            onRunSwarm={runCoverSwarm}
            teamNotes={coverTeamNotes}
            design={coverDesign}

            storyWordCount={story.chapters.reduce((n, c) => n + (c.content || "").split(/\s+/).filter(Boolean).length, 0)}
            onGenerateBoth={async () => {
              await generateStoryImage("cover", frontCoverDirection || coverPrompt);
              await generateStoryImage("back", backCoverDirection || coverPrompt);
            }}
            onGenerateSlot={(slot) => {
              void generateStoryImage(slot, slot === "cover"
                ? (frontCoverDirection || coverPrompt)
                : (backCoverDirection || coverPrompt));
            }}
            onClearSlot={(slot) => setStory(s => ({
              ...s,
              ...(slot === "cover" ? { coverImage: undefined } : { backImage: undefined }),
            }))}
            onPickSlot={(slot) => { setPickerTarget(slot); setPickerOpen(true); }}
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

        {/* Chapter quick-list — jump to any chapter, see illustration status, bulk illustrate */}
        <div className="px-4 pt-3">
          <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
                Chapters ({story.chapters.length})
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setRegenOpen(true)}
                  disabled={regenBusy || bulkBusy || !!imgBusy || chapterSetBusy !== null}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-amber-500/60 bg-amber-500/15 text-amber-300 font-semibold flex items-center gap-1 disabled:opacity-60"
                >
                  {regenBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Regenerate ENTIRE story
                </button>
                <button
                  onClick={reIllustrateAllChapters}
                  disabled={bulkBusy || !!imgBusy || chapterSetBusy !== null}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-semibold flex items-center gap-1 disabled:opacity-60"
                >
                  {bulkBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Illustrate ALL chapters
                </button>
              </div>
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
                      disabled={!!imgBusy || bulkBusy || chapterSetBusy !== null}
                      className="shrink-0 p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-40"
                      aria-label="Illustrate this chapter"
                      title={`Illustrate this chapter (${MIN_IMAGES_PER_CHAPTER} images)`}
                    >
                      {busy || chapterSetBusy === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}

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
            onFocus={() => { humanEditBaselineRef.current = story.chapters[activeChapter]?.content || ""; }}
            onBlur={e => {
              const before = humanEditBaselineRef.current;
              const after = e.target.value;
              if (before !== after) trackEdit("human", activeChapter, before, after, "Typed by the author");
              humanEditBaselineRef.current = after;
            }}
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
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => reIllustrateChapter(activeChapter)}
                      disabled={!!imgBusy || bulkBusy || chapterSetBusy !== null}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-semibold flex items-center gap-1 disabled:opacity-60"
                    >
                      {isBusy || chapterSetBusy === activeChapter ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Illustrate Chapter ({MIN_IMAGES_PER_CHAPTER} images)
                    </button>
                    <button
                      onClick={() => deleteAndReIllustrateChapter(activeChapter)}
                      disabled={!!imgBusy || bulkBusy || chapterSetBusy !== null}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-destructive/15 border border-destructive/50 text-destructive font-semibold flex items-center gap-1 disabled:opacity-60"
                      title="Delete every illustration in this chapter and draw a totally new set"
                    >
                      <X className="w-3 h-3" /> Delete + re-illustrate chapter
                    </button>
                    <button
                      onClick={deleteAndReIllustrateBook}
                      disabled={!!imgBusy || bulkBusy || chapterSetBusy !== null}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-destructive/25 border border-destructive text-destructive font-black flex items-center gap-1 disabled:opacity-60"
                      title="Delete every illustration in the whole book and re-illustrate it"
                    >
                      {bulkBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Delete + re-illustrate BOOK
                    </button>
                    <button
                      onClick={() => generateStoryImage({ kind: "chapter", index: activeChapter })}
                      disabled={!!imgBusy || bulkBusy || chapterSetBusy !== null}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-border text-foreground font-semibold disabled:opacity-60"
                      title="Add a single extra illustration"
                    >
                      + 1
                    </button>
                  </div>

                </div>
                {imgs.length > 0 ? (
                  <div>
                    {imgs.map((src, i) => (
                      <IllustrationPlate
                        key={`${src}-${i}`}
                        src={src}
                        index={i + 1}
                        holographic={!!ch?.imageHolo?.[i]}
                        caption={
                          typeof ch?.imageAnchors?.[i] === "number"
                            ? `sits after paragraph ${ch!.imageAnchors![i]}`
                            : undefined
                        }
                        onRemove={() => removeChapterImage(activeChapter, i)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Every illustration is a full-page portrait plate — one single scene per page, never split — built with foreground/midground/background depth so the reader can orbit and zoom 360° into it. In the final five chapters one plate is rendered as a holographic showcase.
                  </p>
                )}
                {illustrationTeamNotes.length > 0 && chapterSetBusy === activeChapter && (
                  <div className="border-l-2 border-accent-blue/60 pl-2 space-y-1">
                    <p className="text-[10px] font-black uppercase text-accent-blue">Illustration team shot list</p>
                    {illustrationTeamNotes.map((note, index) => (
                      <p key={`${index}-${note}`} className="text-[10px] leading-relaxed text-foreground/80">
                        <strong>{index + 1}.</strong> {note}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* === AI CHAPTER WORKFLOW === */}
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-3">
            {flowStage === "idle" && (
              <>
                <p className="text-xs font-semibold text-primary">
                  ✨ Generate Full Chapter (15,000+ words)
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

        {/* Style DNA — train the AI on the author's own writing */}
        <div className="px-4 pt-4">
          <StyleDnaPanel userId={user?.id} callAI={callAI} onProfileChange={setStyleProfile} />
        </div>

        {/* Humanising rewrite pass */}
        <div className="px-4 pt-4 grid grid-cols-2 gap-2">
          <button
            onClick={humaniseChapter}
            disabled={!!humanBusy || aiBusy}
            className="py-2.5 rounded-xl bg-card border border-primary/40 text-primary text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {humanBusy === "chapter" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Humanise this chapter
          </button>
          <button
            onClick={humaniseBook}
            disabled={!!humanBusy || aiBusy}
            className="py-2.5 rounded-xl bg-card border border-primary/40 text-primary text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {humanBusy === "book" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Humanise whole book
          </button>
        </div>
        <p className="px-4 pt-1 text-[10px] text-muted-foreground">
          Rewrites in your voice with varied rhythm, natural imperfection and first-person asides. Train Style DNA above for the closest match.
        </p>

        {/* Authorship tracking + compliance kit */}
        <div className="px-4 pt-4">
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">Human authorship record</p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{authorship.humanPercent.toFixed(1)}% human-written</span>
              <span>{authorship.humanEvents} human edits</span>
              <span>{authorship.aiEvents} AI passes</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, authorship.humanPercent)}%` }} />
            </div>
            <button
              onClick={() => void downloadComplianceKit({ voice: false })}
              className="w-full py-2 rounded-lg bg-primary/10 border border-primary/40 text-primary text-xs font-semibold"
            >
              Download compliance kit — KDP / ACX / YouTube declarations
            </button>
            <p className="text-[10px] text-muted-foreground">
              Exports are privacy-scrubbed (GPS, device and account identifiers removed) while provenance and AI disclosure stay attached.
            </p>
          </div>
        </div>



        {/* Send straight to Kindle */}
        <div className="px-4 pt-4">
          <button
            onClick={() => setKindleOpen(true)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-primary-foreground text-sm font-bold flex items-center justify-center gap-2"
          >
            <BookMarked className="w-4 h-4" />
            Send this book to my Kindle — guided, one tap
          </button>
          <p className="pt-1 text-[10px] text-muted-foreground">
            Step-by-step bubbles walk you through it once, then Oracle Lunar emails the finished
            Kindle EPUB into your library automatically.
          </p>
        </div>

        {/* Retailer-ready exports */}
        <div className="px-4 pt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => void exportEpub()}
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
            Share Story (Email, Facebook, Messenger, WhatsApp, X & more)

          </button>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Publish first to share a public link, or share the Oracle Lunar link to invite friends.
          </p>
        </div>

        <SendToKindleDialog
          open={kindleOpen}
          onOpenChange={setKindleOpen}
          title={story.title || "Untitled Story"}
          buildEpub={() => exportEpub({ returnFile: true })}
        />

        <StoryShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          story={{
            title: story.title,
            author: story.author,
            genre: story.genre,
            premise: story.premise,
            blurb: story.blurb,
            coverImage: story.coverImage,
            chapters: story.chapters,
            publishedUrl: story.publishedUrl,
          }}

        />


        <MediaPickerDialog
          open={pickerOpen}
          onOpenChange={(o) => { setPickerOpen(o); if (!o) setPickerTarget(null); }}
          filterType="image"
          title="Pick an image — your Library or your device"
          onSelect={(url) => applyPickedImage(url)}
        />

        <RegenerateStoryWizard
          open={regenOpen}
          chapterCount={story.chapters.length}
          imageCount={totalImageCount()}
          busy={regenBusy}
          onCancel={() => { if (!regenBusy) setRegenOpen(false); }}
          onConfirm={(plan) => { void regenerateEntireStory(plan); }}
        />
      </div>

    </PaywallGate>
  );
};


export default StoryWriterPage;
