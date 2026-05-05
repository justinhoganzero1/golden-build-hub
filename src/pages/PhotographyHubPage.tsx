import { useState, useRef } from "react";
import { Camera, Wand2, Loader2, Download, Sparkles, Upload, Share2, ImagePlus, FolderOpen, Pencil } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ShareDialog from "@/components/ShareDialog";
import MediaPickerDialog from "@/components/MediaPickerDialog";
import PhotoEditStudio from "@/components/PhotoEditStudio";
import { useSaveMedia } from "@/hooks/useUserAvatars";
import { useAuth } from "@/contexts/AuthContext";
import { moderatePrompt } from "@/lib/contentSafety";
import { downloadFileFromUrl } from "@/lib/utils";
import PaywallGate from "@/components/PaywallGate";
import { supabase } from "@/integrations/supabase/client";
import PhotoBrandKitPanel from "@/components/PhotoBrandKitPanel";
import { HeyGenAffiliateCTA } from "@/components/HeyGenAffiliateCTA";
import PartnerPowerSuite from "@/components/PartnerPowerSuite";
import PhotoAIPowerLab from "@/components/PhotoAIPowerLab";
import MovieStudio from "@/components/MovieStudio";
import { Film, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  PHOTO_TRIAL_LIMIT,
  getPhotoTrialCount,
  incrementPhotoTrial,
  hasPhotoTrialRemaining,
} from "@/lib/photoTrial";

const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

const filters = ["None", "Vivid", "Noir", "Vintage", "Dreamy", "Cinematic"];

/**
 * 8K Photo Studio — still-image only.
 * Generate-from-text or Edit-uploaded-photo. Output is upscaled to 8K via Replicate
 * and auto-saved to the Media Library. Cinematic clip work moved to Vault.
 */
const PhotographyHubPage = () => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const saveMedia = useSaveMedia();
  const [trialCount, setTrialCount] = useState(() => getPhotoTrialCount(user?.id));
  const trialRemaining = Math.max(0, PHOTO_TRIAL_LIMIT - trialCount);
  const trialExhausted = !isAdmin && trialRemaining <= 0;
  const bumpTrial = () => {
    if (isAdmin) return;
    setTrialCount(incrementPhotoTrial(user?.id));
  };
  const enforceTrial = (count = 1): boolean => {
    if (isAdmin) return true;
    if (getPhotoTrialCount(user?.id) + count > PHOTO_TRIAL_LIMIT) {
      toast.error("🔒 Free trial used (6 images). Upgrade to keep generating.");
      navigate("/subscribe");
      return false;
    }
    return true;
  };
  const [prompt, setPrompt] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("None");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  // NEW — multi-image stack (up to 16). Drives the "Edit My Photos" frame and the
  // "Compile Marketing Video" feature. Index 0 is what single-image edit uses.
  const [photoStack, setPhotoStack] = useState<string[]>([]);
  const MAX_STACK = 16;
  const [showShare, setShowShare] = useState(false);
  const [mode, setMode] = useState<"generate" | "edit">("generate");
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [compilingVideo, setCompilingVideo] = useState(false);
  const [showMovieStudio, setShowMovieStudio] = useState(false);
  const [movieSeedImage, setMovieSeedImage] = useState<string | null>(null);
  const [movieSeedFrames, setMovieSeedFrames] = useState<string[] | undefined>(undefined);
  const [movieSeedScript, setMovieSeedScript] = useState<string | undefined>(undefined);
  // Photo Story: 10 sequential frames with consistent characters/wardrobe
  const [storyDescription, setStoryDescription] = useState("");
  const [storyFrames, setStoryFrames] = useState<string[]>([]);
  const [storyProgress, setStoryProgress] = useState<{ done: number; total: number } | null>(null);
  const [generatingStory, setGeneratingStory] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = MAX_STACK - photoStack.length;
    if (remaining <= 0) {
      toast.error(`Stack is full — max ${MAX_STACK} images.`);
      return;
    }
    const accept = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.warning(`Only added ${remaining} (max ${MAX_STACK}).`);
    }

    let loaded = 0;
    const newOnes: string[] = [];
    accept.forEach((file) => {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name}: not an image`); loaded++; return; }
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name}: max 10MB`); loaded++; return; }
      const reader = new FileReader();
      reader.onload = () => {
        newOnes.push(reader.result as string);
        loaded++;
        if (loaded === accept.length) {
          setPhotoStack((prev) => {
            const next = [...prev, ...newOnes].slice(0, MAX_STACK);
            // Keep legacy single-photo state in sync for the existing edit pipeline.
            setUploadedPhoto(next[0] ?? null);
            return next;
          });
          setMode("edit");
          toast.success(`Added ${newOnes.length} image${newOnes.length === 1 ? "" : "s"} to the stack.`);
        }
      };
      reader.readAsDataURL(file);
    });
    // Clear the input so re-selecting the same file fires onChange again.
    e.target.value = "";
  };

  const removeFromStack = (idx: number) => {
    setPhotoStack((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setUploadedPhoto(next[0] ?? null);
      return next;
    });
  };

  const compileMarketingVideo = async () => {
    if (photoStack.length < 2) {
      toast.error("Add at least 2 images to compile a video.");
      return;
    }
    if (!user) {
      toast.error("Sign in to compile a marketing video.");
      return;
    }
    setCompilingVideo(true);
    try {
      const { data, error } = await supabase.functions.invoke("compile-marketing-video", {
        body: {
          images: photoStack,
          title: prompt.trim() || "ORACLE LUNAR Marketing Reel",
          per_image_seconds: 2.5,
          aspect: "9:16",
        },
      });
      if (error) throw error;
      const url = (data as any)?.video_url;
      if (!url) throw new Error("No video URL returned");
      toast.success("Marketing video compiled and saved to your library!");
      saveMedia.mutate({
        media_type: "video",
        title: `Marketing Reel — ${new Date().toLocaleDateString()}`,
        url,
        source_page: "photography-hub",
        metadata: { compiled_from: photoStack.length, kind: "marketing_reel" },
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Compile failed — coming soon.");
    } finally {
      setCompilingVideo(false);
    }
  };


  const upscaleTo8K = async (imageUrl: string): Promise<string> => {
    try {
      setIsUpscaling(true);
      const { data, error } = await supabase.functions.invoke("replicate-upscale", {
        body: { imageUrl, scale: 4 },
      });
      if (error) throw error;
      const upscaled = (data as any)?.url || (data as any)?.imageUrl;
      return upscaled || imageUrl;
    } catch (e) {
      console.warn("8K upscale failed, returning base image", e);
      return imageUrl;
    } finally {
      setIsUpscaling(false);
    }
  };

  const generatePhoto = async () => {
    if (!prompt.trim()) return;
    const moderation = moderatePrompt(prompt);
    if (!moderation.ok) { toast.error(moderation.reason); return; }
    if (!enforceTrial(1)) return;
    setIsGenerating(true);
    setGeneratedImage(null);
    const filterPrompt = selectedFilter !== "None" ? `, ${selectedFilter.toLowerCase()} photography style` : "";

    try {
      const body: any = {
        prompt: mode === "edit"
          ? `Edit this photo: ${prompt.trim()}${filterPrompt}. Keep the person recognizable. Ultra-high resolution, photorealistic, sharp 8K detail.`
          : `Professional ultra-high-resolution 8K photograph: ${prompt.trim()}${filterPrompt}. DSLR quality, perfect composition, razor-sharp focus, fine detail.`,
      };
      if (mode === "edit" && uploadedPhoto) body.inputImage = uploadedPhoto;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in again to generate images.");
        return;
      }
      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Generation failed");
        return;
      }
      const data = await resp.json();
      const baseUrl = data.images?.[0]?.image_url?.url;
      if (!baseUrl) { toast.error("No image returned"); return; }

      toast.success("Base photo ready — upscaling to 8K…");
      const finalUrl = await upscaleTo8K(baseUrl);
      setGeneratedImage(finalUrl);
      toast.success(mode === "edit" ? "8K photo transformed! ✨" : "8K photo generated!");
      bumpTrial();

      if (user) {
        saveMedia.mutate({
          media_type: "image",
          title: `${mode === "edit" ? "Edited" : "Generated"} 8K Photo - ${prompt.slice(0, 50)}`,
          url: finalUrl,
          source_page: "photography-hub",
          metadata: { filter: selectedFilter, mode, prompt, resolution: "8k" },
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate photo");
    } finally {
      setIsGenerating(false);
    }
  };

  // ----- Photo Story: 10 sequential frames, same characters & wardrobe -----
  const generatePhotoStory = async () => {
    const desc = storyDescription.trim();
    if (!desc) { toast.error("Describe your story and characters first."); return; }
    const moderation = moderatePrompt(desc);
    if (!moderation.ok) { toast.error(moderation.reason); return; }
    if (!enforceTrial(10)) {
      toast.info(`The 10-frame story needs 10 generations — you have ${trialRemaining} free left.`);
      return;
    }
    setGeneratingStory(true);
    setStoryFrames([]);
    setStoryProgress({ done: 0, total: 10 });
    try {
      // Step 1: ask AI to break the story into 10 scene prompts that all share
      // the same characters, outfits, and visual style.
      toast.info("Planning 10 scenes with consistent characters…");
      const planResp = await supabase.functions.invoke("script-to-scenes", {
        body: {
          script: desc,
          intent: "Generate exactly 10 still photos. CRITICAL: every photo must show the SAME characters with the SAME faces, SAME hair, SAME outfits/wardrobe, SAME body types. Vary only the scene, location, action, and pose. Lock the visual style across all 10 frames.",
          targetDurationSec: 60, // 10 scenes × 6s
        },
      });
      if (planResp.error) throw planResp.error;
      const scenes: any[] = (planResp.data as any)?.scenes?.slice(0, 10) || [];
      if (scenes.length < 1) throw new Error("Could not plan scenes.");

      // Step 2: generate frame 1 first as the "character anchor"
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error("Please sign in again."); return; }
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      const wardrobeLock = `Maintain identical character identity, faces, hair, skin tone, body type, AND identical wardrobe/outfits across this sequence. Photoreal 8K, cinematic lighting.`;

      const frames: string[] = [];
      let anchorImage: string | null = null;
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        const scenePrompt = `Frame ${i + 1} of 10. ${s.photo_prompt || s.caption}. ${wardrobeLock}`;
        const body: any = { prompt: scenePrompt };
        // After frame 1, pass the anchor as inputImage for character continuity
        if (anchorImage) body.inputImage = anchorImage;
        const resp = await fetch(GEN_URL, { method: "POST", headers, body: JSON.stringify(body) });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `Frame ${i + 1} failed`);
        }
        const data = await resp.json();
        const url = data.images?.[0]?.image_url?.url;
        if (!url) throw new Error(`Frame ${i + 1} returned no image`);
        frames.push(url);
        bumpTrial();
        if (!anchorImage) anchorImage = url; // lock anchor on frame 1
        setStoryFrames([...frames]);
        setStoryProgress({ done: i + 1, total: scenes.length });

        if (user) {
          saveMedia.mutate({
            media_type: "image",
            title: `Photo Story Frame ${i + 1}/${scenes.length} — ${desc.slice(0, 40)}`,
            url,
            source_page: "photography-hub",
            metadata: { kind: "photo_story", frame: i + 1, total: scenes.length, story: desc },
          });
        }
      }
      toast.success(`✅ Photo story complete — ${frames.length} frames generated!`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Photo story failed");
    } finally {
      setGeneratingStory(false);
    }
  };

  const busy = isGenerating || isUpscaling;

  return (
    <PaywallGate requiredTier="starter" featureName="8K Photo Studio">
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Camera className="w-7 h-7 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold text-primary">8K Photo Studio</h1>
            <p className="text-muted-foreground text-xs">Ultra-high-resolution still images · Generate or Edit</p>
          </div>
        </div>

        {/* Free trial counter */}
        {!isAdmin && (
          trialExhausted ? (
            <div className="mb-4 p-3 rounded-xl border border-destructive/40 bg-destructive/10 flex items-center gap-3">
              <Lock className="w-5 h-5 text-destructive shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-destructive">Free trial used</p>
                <p className="text-[11px] text-muted-foreground">You've generated {PHOTO_TRIAL_LIMIT}/{PHOTO_TRIAL_LIMIT} free images. Upgrade to keep creating.</p>
              </div>
              <button onClick={() => navigate("/subscribe")}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold whitespace-nowrap">
                Upgrade
              </button>
            </div>
          ) : (
            <div className="mb-4 p-2.5 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                🎁 Free trial: <strong className="text-primary">{trialRemaining}/{PHOTO_TRIAL_LIMIT}</strong> images left
              </span>
              <button onClick={() => navigate("/subscribe")}
                className="px-2.5 py-1 rounded-md bg-primary/15 border border-primary/30 text-primary text-[11px] font-semibold">
                Upgrade for unlimited
              </button>
            </div>
          )
        )}

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setMode("generate")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all ${mode === "generate" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
            <Sparkles className="w-4 h-4" /> Generate New
          </button>
          <button onClick={() => { setMode("edit"); if (!uploadedPhoto) fileRef.current?.click(); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all ${mode === "edit" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
            <ImagePlus className="w-4 h-4" /> Edit My Photo
          </button>
          <button onClick={() => setShowMediaPicker(true)}
            className="py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1 bg-card border border-border text-muted-foreground hover:border-primary transition-colors">
            <FolderOpen className="w-4 h-4" />
          </button>
        </div>

        {/* Uploaded Photo Stack — up to 16 images, displayed as stacked frames */}
        {mode === "edit" && (
          <div className="mb-4">
            {photoStack.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">
                    {photoStack.length}/{MAX_STACK} image{photoStack.length === 1 ? "" : "s"} in stack
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => fileRef.current?.click()}
                      disabled={photoStack.length >= MAX_STACK}
                      className="px-3 py-1.5 rounded-lg text-[11px] bg-primary/15 border border-primary/30 text-primary disabled:opacity-40 flex items-center gap-1">
                      <Upload className="w-3 h-3" /> Add more
                    </button>
                    <button onClick={() => { setPhotoStack([]); setUploadedPhoto(null); }}
                      className="px-3 py-1.5 rounded-lg text-[11px] bg-card border border-border text-muted-foreground hover:border-destructive">
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 p-2 rounded-xl bg-card border border-primary/30">
                  {photoStack.map((src, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-primary/20 group">
                      <img src={src} alt={`Stack ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-primary">
                        #{i + 1}
                      </div>
                      <button onClick={() => removeFromStack(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/90 text-destructive-foreground text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Compile to Marketing Video */}
                <button
                  onClick={compileMarketingVideo}
                  disabled={photoStack.length < 2 || compilingVideo}
                  className="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {compilingVideo ? "Compiling reel…" : `🎬 Compile ${photoStack.length} images → Marketing Video`}
                </button>
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  Stack screenshots, products or moodboards — Oracle compiles them into a vertical reel ready for TikTok / Reels / Shorts.
                </p>
              </>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full aspect-video bg-card border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary transition-colors mb-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Upload up to 16 photos</p>
                <p className="text-[10px] text-muted-foreground">Tap to select multiple • Max 10MB each</p>
              </button>
            )}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />


        {/* Result Preview */}
        {generatedImage && (
          <div className="mb-4">
            <div className="aspect-square bg-card border border-primary/30 rounded-xl overflow-hidden relative">
              <img src={generatedImage} alt="Generated 8K photo" className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-bold tracking-wider">
                8K
              </div>
              <div className="absolute top-2 right-2 flex gap-2">
                <button onClick={() => setShowShare(true)} className="p-2 bg-primary/80 rounded-lg"><Share2 className="w-4 h-4 text-primary-foreground" /></button>
                <button onClick={async () => {
                  try {
                    await downloadFileFromUrl(generatedImage, `oracle-lunar-8k-photo-${Date.now()}`);
                    toast.success("8K image downloaded");
                  } catch (error) {
                    console.error(error);
                    toast.error("Failed to download image");
                  }
                }} className="p-2 bg-primary/80 rounded-lg"><Download className="w-4 h-4 text-primary-foreground" /></button>
              </div>
            </div>
            <button onClick={() => setShowEditor(true)}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
              <Pencil className="w-4 h-4" /> Open Edit Studio
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Prompt Input */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {mode === "edit" ? "Describe the transformation" : "8K Photo Generator"}
            </span>
          </div>
          <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && generatePhoto()}
            placeholder={mode === "edit"
              ? "e.g. Make me look like a superhero, put me on a beach…"
              : "Describe the 8K photo you want (e.g. sunset over mountains)…"
            }
            className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary mb-3" />
          <button onClick={generatePhoto} disabled={busy || !prompt.trim() || (mode === "edit" && !uploadedPhoto)}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isUpscaling ? "Upscaling to 8K…" : isGenerating ? "Generating…" : mode === "edit" ? "Transform to 8K" : "Generate 8K Photo"}
          </button>
        </div>

        {/* Filters */}
        <h2 className="text-sm font-semibold text-foreground mb-3">Style Filter</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.map(f => (
            <button key={f} onClick={() => setSelectedFilter(f)}
              className={`px-3 py-2 rounded-full text-xs font-medium transition-colors ${selectedFilter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              {f}
            </button>
          ))}
        </div>

        <PhotoAIPowerLab
          className="mb-4"
          onApplyPreset={({ prompt: pp, filter: ff, mode: mm }) => {
            setPrompt(pp);
            setSelectedFilter(ff);
            setMode(mm);
            if (mm === "edit" && !uploadedPhoto) {
              toast.info("Upload a photo to transform — opening picker");
              fileRef.current?.click();
            } else {
              toast.success("Preset loaded — tap Generate");
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />

        <PhotoBrandKitPanel
          currentImage={generatedImage}
          prompt={prompt}
          filter={selectedFilter}
          mode={mode}
          onApplyTemplate={(t) => {
            setPrompt(t.prompt);
            setSelectedFilter(t.filter);
            setMode(t.mode);
            toast.success("Template loaded");
          }}
        />

        {/* Photo Story — 10 sequential frames, same characters & wardrobe */}
        <div className="mt-6 mb-4 rounded-2xl border border-primary/40 bg-gradient-to-br from-amber-500/10 via-background to-primary/15 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ImagePlus className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">📸 Photo Story — 10 Frames</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Generate <strong>10 sequential photos</strong> featuring the same characters in the same outfits across different scenes.
            Describe your story and characters, and Oracle will keep them consistent through all 10 frames.
          </p>
          <textarea
            value={storyDescription}
            onChange={(e) => setStoryDescription(e.target.value)}
            rows={3}
            placeholder="e.g. Maya (red leather jacket, dark curly hair) and Jake (blue denim, blonde) explore an abandoned mansion at night — finding clues, discovering a hidden room, escaping at dawn."
            className="w-full px-3 py-2 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary mb-2"
          />
          <button
            onClick={generatePhotoStory}
            disabled={generatingStory || !storyDescription.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
            {generatingStory ? (
              <><Loader2 className="w-4 h-4 animate-spin" />
                Generating frame {storyProgress?.done ?? 0} of {storyProgress?.total ?? 10}…
              </>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate 10-Frame Photo Story</>
            )}
          </button>
          {storyFrames.length > 0 && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {storyFrames.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-primary/30 group">
                    <img src={src} alt={`Story frame ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-bold text-primary">
                      {i + 1}/10
                    </div>
                    <button
                      onClick={() => downloadFileFromUrl(src, `photo-story-${i + 1}-${Date.now()}`)}
                      className="absolute bottom-1 right-1 p-1 rounded bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Download className="w-3 h-3 text-primary-foreground" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setMovieSeedFrames(storyFrames);
                  setMovieSeedScript(storyDescription);
                  setMovieSeedImage(storyFrames[0] || null);
                  setShowMovieStudio(true);
                  toast.success("Loading your 10 photos into Movie Studio…");
                }}
                className="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-lg">
                <Film className="w-4 h-4" />
                🎬 Turn These 10 Photos Into a Movie
                <Sparkles className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Story → Image → Storyboard → Movie pipeline */}
        <div className="mt-6 mb-4 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-background to-amber-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Film className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">🎬 Movie Studio</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Turn your story into a full movie. Step 1: write your story above and generate the first image.
            Step 2: tap below — Oracle will build a storyboard from that image, then render every scene into a complete movie.
          </p>
          <button
            onClick={() => {
              if (!prompt.trim()) {
                toast.error("Write your story in the prompt box above first.");
                return;
              }
              setMovieSeedImage(generatedImage);
              setShowMovieStudio(true);
              if (!generatedImage) {
                toast.info("Tip: generate the opening image first for better continuity.");
              } else {
                toast.success("Storyboard builder opened — Oracle will plan your scenes.");
              }
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-lg">
            <Film className="w-4 h-4" />
            {generatedImage ? "Build Storyboard → Generate Movie" : "Open Movie Studio"}
            <Sparkles className="w-4 h-4" />
          </button>
        </div>

        <HeyGenAffiliateCTA
          placement="photography_hub_animate"
          title="Bring This Photo to Life"
          description="Animate your 8K photo into a talking AI character video with HeyGen. Perfect for stories, ads, and social posts."
          ctaLabel="Animate with HeyGen →"
        />

        <PartnerPowerSuite placementPrefix="photo_hub" filter="all" />
      </div>

      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        title="8K AI Photo"
        url={generatedImage || undefined}
        imageUrl={generatedImage || undefined}
        description="Check out this 8K AI-generated photo from Oracle Lunar!"
      />
      <MediaPickerDialog
        open={showMediaPicker}
        onOpenChange={setShowMediaPicker}
        filterType="image"
        title="Pick from Library"
        onSelect={(url) => { setUploadedPhoto(url); setMode("edit"); toast.success("Image loaded from library!"); }}
      />
      {generatedImage && (
        <PhotoEditStudio
          open={showEditor}
          onOpenChange={setShowEditor}
          imageUrl={generatedImage}
          onSave={(newUrl) => {
            setGeneratedImage(newUrl);
            if (user) {
              saveMedia.mutate({
                media_type: "image",
                title: `Edited 8K Photo - ${prompt.slice(0, 50) || "studio edit"}`,
                url: newUrl,
                source_page: "photography-hub",
                metadata: { editedInStudio: true, basePrompt: prompt, resolution: "8k" },
              });
            }
          }}
        />
      )}
      <MovieStudio
        open={showMovieStudio}
        onOpenChange={setShowMovieStudio}
        seedImage={movieSeedImage}
      />
    </div>
    </PaywallGate>
  );
};

export default PhotographyHubPage;
