import { useState, useRef } from "react";
import { Camera, Wand2, Loader2, Download, Sparkles, Upload, Share2, ImagePlus, FolderOpen, Pencil, Film } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ShareDialog from "@/components/ShareDialog";
import MediaPickerDialog from "@/components/MediaPickerDialog";
import PhotoEditStudio from "@/components/PhotoEditStudio";
import MovieStudio from "@/components/MovieStudio";
import { useSaveMedia } from "@/hooks/useUserAvatars";
import { useAuth } from "@/contexts/AuthContext";
import { moderatePrompt } from "@/lib/contentSafety";
import { downloadFileFromUrl } from "@/lib/utils";
import PaywallGate from "@/components/PaywallGate";

const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

const filters = ["None", "Vivid", "Noir", "Vintage", "Dreamy", "Cinematic"];

const PhotographyHubPage = () => {
  const { user } = useAuth();
  const saveMedia = useSaveMedia();
  const [prompt, setPrompt] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("None");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [mode, setMode] = useState<"generate" | "edit">("generate");
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showMovieStudio, setShowMovieStudio] = useState(false);
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

  const generatePhoto = async () => {
    if (!prompt.trim()) return;
    const moderation = moderatePrompt(prompt);
    if (!moderation.ok) {
      toast.error(moderation.reason);
      return;
    }
    setIsGenerating(true);
    setGeneratedImage(null);
    const filterPrompt = selectedFilter !== "None" ? `, ${selectedFilter.toLowerCase()} photography style` : "";

    try {
      const body: any = {
        prompt: mode === "edit"
          ? `Edit this photo: ${prompt.trim()}${filterPrompt}. Keep the person recognizable. High quality.`
          : `Professional high-resolution photograph: ${prompt.trim()}${filterPrompt}. DSLR quality, sharp focus, beautiful composition.`,
      };
      if (mode === "edit" && uploadedPhoto) {
        body.inputImage = uploadedPhoto;
      }

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
      const imgUrl = data.images?.[0]?.image_url?.url;
      if (imgUrl) {
        setGeneratedImage(imgUrl);
        toast.success(mode === "edit" ? "Photo transformed! ✨" : "Photo generated!");
        // Auto-save to media library
        if (user) {
          saveMedia.mutate({
            media_type: "image",
            title: `${mode === "edit" ? "Edited" : "Generated"} Photo - ${prompt.slice(0, 50)}`,
            url: imgUrl,
            source_page: "photography-hub",
            metadata: { filter: selectedFilter, mode, prompt },
          });
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate photo");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <PaywallGate requiredTier="starter" featureName="Photography Hub (AI image generation)">
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Camera className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Photography Hub</h1><p className="text-muted-foreground text-xs">AI-powered photo creation & editing</p></div>
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

        {/* Movie Studio launcher (always available, prominent) */}
        <button onClick={() => setShowMovieStudio(true)}
          className="w-full mb-4 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-primary to-amber-500 border-2 border-primary/60 text-primary-foreground font-bold text-base flex items-center justify-center gap-2 shadow-[0_0_30px_hsl(var(--primary)/0.5)] hover:shadow-[0_0_50px_hsl(var(--primary)/0.7)] transition-all animate-pulse">
          <Film className="w-5 h-5" /> 🎬 Open Movie Studio
          <span className="text-[11px] opacity-90 font-medium">8K · 6s clips</span>
        </button>

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
              <img src={generatedImage} alt="Generated photo" className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 flex gap-2">
                <button onClick={() => setShowShare(true)} className="p-2 bg-primary/80 rounded-lg"><Share2 className="w-4 h-4 text-primary-foreground" /></button>
                <button onClick={async () => {
                  try {
                    await downloadFileFromUrl(generatedImage, `solace-photo-${Date.now()}`);
                    toast.success("Image downloaded");
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
            <button onClick={() => setShowMovieStudio(true)}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
              <Film className="w-4 h-4" /> Turn into Movie (8K · 6s clips)
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Prompt Input */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {mode === "edit" ? "Describe the transformation" : "AI Photo Generator"}
            </span>
          </div>
          <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && generatePhoto()}
            placeholder={mode === "edit"
              ? "e.g. Make me look like a superhero, put me on a beach, make it a painting..."
              : "Describe the photo you want (e.g. sunset over mountains)..."
            }
            className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary mb-3" />
          <button onClick={generatePhoto} disabled={isGenerating || !prompt.trim() || (mode === "edit" && !uploadedPhoto)}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? "Processing..." : mode === "edit" ? "Transform Photo" : "Generate Photo"}
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
      </div>

      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        title="AI Photo"
        url={generatedImage || undefined}
        imageUrl={generatedImage || undefined}
        description="Check out this AI-generated photo from Solace!"
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
                title: `Edited Photo - ${prompt.slice(0, 50) || "studio edit"}`,
                url: newUrl,
                source_page: "photography-hub",
                metadata: { editedInStudio: true, basePrompt: prompt },
              });
            }
          }}
        />
      )}
      <MovieStudio open={showMovieStudio} onOpenChange={setShowMovieStudio} seedImage={generatedImage || uploadedPhoto} />
    </div>
    </PaywallGate>
  );
};

export default PhotographyHubPage;
