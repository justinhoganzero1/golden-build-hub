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

const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

const filters = ["None", "Vivid", "Noir", "Vintage", "Dreamy", "Cinematic"];

/**
 * 8K Photo Studio — still-image only.
 * Generate-from-text or Edit-uploaded-photo. Output is upscaled to 8K via Replicate
 * and auto-saved to the Media Library. Cinematic clip work moved to Vault.
 */
const PhotographyHubPage = () => {
  const { user } = useAuth();
  const saveMedia = useSaveMedia();
  const [prompt, setPrompt] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("None");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [mode, setMode] = useState<"generate" | "edit">("generate");
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedPhoto(reader.result as string);
      setMode("edit");
      toast.success("Photo uploaded! Describe how to transform it.");
    };
    reader.readAsDataURL(file);
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

      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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

        {/* Uploaded Photo Preview */}
        {mode === "edit" && (
          <div className="mb-4">
            {uploadedPhoto ? (
              <div className="relative aspect-square bg-card border border-primary/30 rounded-xl overflow-hidden mb-2">
                <img src={uploadedPhoto} alt="Uploaded" className="w-full h-full object-cover" />
                <button onClick={() => fileRef.current?.click()}
                  className="absolute bottom-2 right-2 px-3 py-1.5 bg-primary/80 text-primary-foreground rounded-lg text-xs flex items-center gap-1">
                  <Upload className="w-3 h-3" /> Change
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full aspect-video bg-card border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary transition-colors mb-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Upload your photo</p>
                <p className="text-[10px] text-muted-foreground">Tap to select • Max 10MB</p>
              </button>
            )}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

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
    </div>
    </PaywallGate>
  );
};

export default PhotographyHubPage;
