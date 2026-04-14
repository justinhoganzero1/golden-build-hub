import { useState, useRef } from "react";
import { Palette, Sparkles, Loader2, Camera, Download, UserPlus, Plus, Mic, Heart, Lock, CreditCard, FolderOpen } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateAvatar, useSaveMedia } from "@/hooks/useUserAvatars";
import MediaPickerDialog from "@/components/MediaPickerDialog";

const STYLES = [
  { value: "realistic-portrait", label: "Realistic Portrait", desc: "Lifelike headshot portrait" },
  { value: "realistic-full", label: "Realistic Full Body", desc: "Lifelike full body portrait" },
  { value: "anime", label: "Anime", desc: "Japanese anime style" },
  { value: "cartoon-3d", label: "3D Cartoon", desc: "Pixar-style 3D character" },
  { value: "comic-book", label: "Comic Book", desc: "Marvel/DC comic style" },
  { value: "pixel-art", label: "Pixel Art", desc: "Retro 8-bit pixel style" },
  { value: "watercolor", label: "Watercolor", desc: "Soft watercolor painting" },
  { value: "cyberpunk", label: "Cyberpunk", desc: "Futuristic neon cyberpunk" },
  { value: "fantasy", label: "Fantasy", desc: "Epic fantasy character" },
  { value: "chibi", label: "Chibi", desc: "Cute small chibi style" },
  { value: "oil-painting", label: "Oil Painting", desc: "Classical oil painting portrait" },
  { value: "minimalist", label: "Minimalist", desc: "Clean minimal design" },
];

const AVATAR_PURPOSES = [
  { value: "oracle", label: "🔮 Main Oracle", desc: "Replace the Oracle's default appearance", paid: false },
  { value: "profile", label: "👤 My Profile", desc: "Use as your profile picture", paid: false },
  { value: "ai-friend", label: "🤖 AI Companion", desc: "Add a realistic AI companion to chat", paid: true, price: "$1" },
  { value: "partner", label: "💕 Boyfriend / Girlfriend", desc: "A romantic AI companion", paid: true, price: "$5/mo" },
];

const VOICE_OPTIONS = [
  "Warm & Friendly", "Deep & Authoritative", "Soft & Gentle", "Raspy & Edgy",
  "Bright & Energetic", "Sultry & Smooth", "Gruff & Tough", "Whispery & ASMR",
  "Booming & Theatrical", "Husky & Mysterious", "Cheerful & Bubbly", "Calm & Meditative",
  "Sarcastic & Dry", "Passionate & Fiery",
];

const PERSONALITY_OPTIONS = [
  "Sweet & Caring", "Bold & Adventurous", "Witty & Sarcastic", "Mysterious & Deep",
  "Playful & Flirty", "Intellectual & Nerdy", "Protective & Loyal", "Chill & Laid-back",
  "Romantic & Poetic", "Energetic & Fun",
];

const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

const AvatarGeneratorPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const purchasedProduct = searchParams.get("purchased");
  const isCreatingFriend = searchParams.get("friend") === "true";
  const purposeFromParam = searchParams.get("purpose");
  const createAvatar = useCreateAvatar();
  const saveMedia = useSaveMedia();

  // Owner detection — only the app owner can create R/X rated avatars
  const OWNER_EMAIL = "justinbretthogan@gmail.com";
  const isOwner = user?.email === OWNER_EMAIL;

  const [selectedStyle, setSelectedStyle] = useState("realistic-full");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [purpose, setPurpose] = useState(purposeFromParam || (isCreatingFriend ? "ai-friend" : purchasedProduct || "oracle"));
  const [selectedVoice, setSelectedVoice] = useState("Warm & Friendly");
  const [selectedPersonality, setSelectedPersonality] = useState("Sweet & Caring");
  const [avatarName, setAvatarName] = useState("");
  const [viewMode, setViewMode] = useState<"holographic-8k" | "normal-3d">("holographic-8k");

  const showVoiceAndPersonality = purpose === "ai-friend" || purpose === "partner";
  const currentPurpose = AVATAR_PURPOSES.find(p => p.value === purpose);
  const isPaidPurpose = currentPurpose?.paid && !purchasedProduct;

  const generate = async () => {
    const desc = prompt.trim() || "a person";
    
    // M-rating content filter for non-owners
    if (!isOwner) {
      const blockedTerms = /\b(nude|naked|nsfw|explicit|sexual|erotic|xxx|porn|hentai|topless|lingerie|underwear|bikini|seductive|provocative|undress|strip)\b/i;
      if (blockedTerms.test(desc)) {
        toast.error("Content must be M-rated. Explicit descriptions are not allowed.");
        return;
      }
    }
    
    // Force realistic style for AI friend and partner avatars
    const effectiveStyle = (purpose === "ai-friend" || purpose === "partner") ? "realistic-portrait" : selectedStyle;
    
    setIsLoading(true);
    try {
      const stylePrompts: Record<string, string> = {
        "realistic-portrait": `Ultra-photorealistic 8K UHD portrait headshot of ${desc}. Shot on a Canon EOS R5 with 85mm f/1.2 lens. Real human with visible pores, skin imperfections, subsurface scattering, natural skin tones, individual hair strands, catch lights in eyes. Professional studio lighting with rim light and fill. Shallow depth of field with creamy bokeh. Indistinguishable from a real photograph. Hyperrealistic, award-winning portrait photography.`,
        "realistic-full": `Ultra-photorealistic 8K UHD full body portrait of ${desc}. Shot on a Hasselblad medium format camera. Real human with natural skin texture, visible pores, realistic fabric materials, accurate body proportions. Professional studio lighting, clean dark background. Hyper-detailed, photojournalistic quality. Looks like a real photograph taken by Annie Leibovitz. Award-winning photography.`,
        "anime": `Anime style character art of ${desc}. Vibrant colors, detailed anime eyes, clean lines, professional anime illustration, 4K quality.`,
        "cartoon-3d": `3D Pixar-style cartoon character of ${desc}. Smooth render, vibrant, clean background, Disney quality, 4K render.`,
        "comic-book": `Comic book hero illustration of ${desc}. Bold ink lines, dynamic pose, vivid colors, Marvel quality, high detail.`,
        "pixel-art": `Pixel art character of ${desc}. 32-bit style, detailed sprites, retro gaming aesthetic.`,
        "watercolor": `Watercolor portrait painting of ${desc}. Soft washes, artistic brushstrokes, elegant composition, fine art quality.`,
        "cyberpunk": `Cyberpunk character of ${desc}. Neon lighting, futuristic augmentations, rain-slicked, blade runner aesthetic, 8K cinematic.`,
        "fantasy": `Epic fantasy character of ${desc}. Magical atmosphere, detailed armor/robes, dramatic lighting, concept art quality.`,
        "chibi": `Cute chibi character of ${desc}. Big head, small body, adorable expression, kawaii style, high quality.`,
        "oil-painting": `Classical oil painting portrait of ${desc}. Renaissance style, rich colors, masterwork quality, museum piece.`,
        "minimalist": `Minimalist flat design avatar of ${desc}. Clean geometric shapes, limited palette, modern design.`,
      };
      const fullPrompt = stylePrompts[effectiveStyle] || `Avatar of ${desc}`;

      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: fullPrompt, ownerBypass: isOwner }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Generation failed");
        return;
      }
      const data = await resp.json();
      if (data.images?.[0]?.image_url?.url) {
        const url = data.images[0].image_url.url;
        setImageUrl(url);
        toast.success("Avatar generated!");
        // Auto-save to media library
        if (user) {
          saveMedia.mutate({
            media_type: "image",
            title: avatarName.trim() || "AI Avatar",
            url,
            source_page: "Avatar Generator",
            metadata: { style: selectedStyle, prompt: desc },
          });
        }
      } else {
        toast.error("No image returned");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate avatar");
    } finally {
      setIsLoading(false);
    }
  };

  const takeSelfie = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      toast.error("Camera access denied");
    }
  };

  const captureSelfie = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const url = canvas.toDataURL("image/png");
    setImageUrl(url);
    const stream = videoRef.current.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setShowCamera(false);
    toast.success("Selfie captured!");
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `solace-avatar-${Date.now()}.png`;
    a.click();
  };

  const handleCheckout = async (product: string) => {
    if (!user) {
      toast.error("Please sign in first");
      navigate("/sign-in");
      return;
    }
    setIsCheckingOut(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-avatar-checkout", {
        body: { product },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to start checkout");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const addAvatar = () => {
    if (!imageUrl) { toast.error("Generate or capture an avatar first"); return; }

    if (isPaidPurpose) {
      handleCheckout(purpose === "partner" ? "partner" : "avatar");
      return;
    }

    const name = avatarName.trim() || "My Avatar";

    // Save to database
    if (user) {
      createAvatar.mutate({
        name,
        purpose,
        voice_style: selectedVoice,
        personality: selectedPersonality,
        image_url: imageUrl,
        art_style: selectedStyle,
        description: prompt.trim() || null,
        is_default: false,
      }, {
        onSuccess: () => {
          toast.success(`"${name}" saved to your gallery!`);
          switch (purpose) {
            case "oracle": navigate("/oracle"); break;
            case "profile": navigate("/profile"); break;
            case "ai-friend": navigate("/ai-studio"); break;
            case "partner": navigate("/ai-companion"); break;
          }
        },
        onError: () => toast.error("Failed to save avatar"),
      });
    } else {
      toast.error("Sign in to save avatars");
      navigate("/sign-in");
    }
  };

  return (
    <div className="min-h-screen pb-20" style={{ background: "#0f0f0f" }}>
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        {purchasedProduct && (
          <div className="bg-gradient-to-r from-green-600/30 to-emerald-600/30 border border-green-500/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-green-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Purchase Successful! ✨</h3>
              <p className="text-xs text-gray-400">
                {purchasedProduct === "partner" ? "AI Partner Experience unlocked!" : "Avatar credits added!"}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10"><Palette className="w-7 h-7 text-purple-400" /></div>
            <div>
              <h1 className="text-xl font-bold text-white">Avatar Generator</h1>
              <p className="text-gray-500 text-xs">
                {isOwner ? "Owner Mode — No content restrictions" : "M-Rated content only"}
              </p>
            </div>
            {isOwner && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[9px] font-bold uppercase">Owner</span>
            )}
          </div>
          <button onClick={() => navigate("/avatar-gallery")} className="px-3 py-1.5 rounded-xl border border-gray-700 text-purple-400 text-xs font-medium">
            Gallery
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left - Controls */}
          <div className="space-y-4">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> What is this avatar for?
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {AVATAR_PURPOSES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPurpose(p.value)}
                    className={`text-left p-3 rounded-xl border transition-all text-xs relative ${
                      purpose === p.value
                        ? "border-purple-500 bg-purple-500/10 text-white"
                        : "border-gray-800 bg-[#0f0f0f] text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    {p.paid && !purchasedProduct && (
                      <div className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> {p.price}
                      </div>
                    )}
                    <div className="font-semibold text-sm mb-0.5">{p.label}</div>
                    <div className="text-[10px] opacity-70">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-white">Design Your Avatar</h2>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Avatar Name</label>
                <input value={avatarName} onChange={e => setAvatarName(e.target.value)} placeholder="e.g. Luna, Shadow, Alex..."
                  className="w-full bg-[#0f0f0f] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Style</label>
                <select value={selectedStyle} onChange={e => setSelectedStyle(e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white appearance-none cursor-pointer">
                  {STYLES.map(s => <option key={s.value} value={s.value}>{s.label} - {s.desc}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Description</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe your avatar..."
                  rows={3} className="w-full bg-[#0f0f0f] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500 resize-none" />
              </div>
              <button onClick={generate} disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} Generate Avatar
              </button>
              <button onClick={takeSelfie}
                className="w-full py-2.5 rounded-xl border border-gray-700 text-purple-400 font-medium text-sm flex items-center justify-center gap-2 hover:border-purple-500">
                <Camera className="w-4 h-4" /> Take a Selfie Instead
              </button>
              <button onClick={() => setShowMediaPicker(true)}
                className="w-full py-2.5 rounded-xl border border-gray-700 text-purple-400 font-medium text-sm flex items-center justify-center gap-2 hover:border-purple-500">
                <FolderOpen className="w-4 h-4" /> Pick from Library
              </button>
            </div>

            {showVoiceAndPersonality && (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Mic className="w-4 h-4 text-purple-400" /> Voice & Personality
                </h2>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Voice Style</label>
                  <div className="flex flex-wrap gap-1.5">
                    {VOICE_OPTIONS.map(v => (
                      <button key={v} onClick={() => setSelectedVoice(v)}
                        className={`px-3 py-1.5 rounded-full text-xs transition-all ${selectedVoice === v ? "bg-purple-600 text-white" : "bg-[#0f0f0f] border border-gray-700 text-gray-400"}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                {purpose === "partner" && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1">
                      <Heart className="w-3 h-3 text-pink-400" /> Personality
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PERSONALITY_OPTIONS.map(p => (
                        <button key={p} onClick={() => setSelectedPersonality(p)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-all ${selectedPersonality === p ? "bg-pink-600 text-white" : "bg-[#0f0f0f] border border-gray-700 text-gray-400"}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right - Preview */}
          <div className="space-y-4">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-3">Preview</h2>
              <div className="aspect-[3/4] rounded-xl bg-[#0f0f0f] border border-gray-800 overflow-hidden flex items-center justify-center">
                {showCamera ? (
                  <div className="relative w-full h-full">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                    <button onClick={captureSelfie} className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-white text-black font-medium text-sm">📸 Capture</button>
                  </div>
                ) : isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                    <p className="text-xs text-gray-500">Generating your avatar...</p>
                  </div>
                ) : imageUrl ? (
                  <img src={imageUrl} alt="Generated avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-gray-600">
                    <Sparkles className="w-16 h-16 text-gray-700" />
                    <p className="text-xs">Your avatar will appear here</p>
                  </div>
                )}
              </div>

              {imageUrl && !showCamera && (
                <div className="flex flex-col gap-2 mt-4">
                  {isPaidPurpose ? (
                    <button onClick={() => handleCheckout(purpose === "partner" ? "partner" : "avatar")} disabled={isCheckingOut}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-500/20">
                      {isCheckingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                      Unlock {currentPurpose?.label} — {currentPurpose?.price}
                    </button>
                  ) : (
                    <button onClick={addAvatar} disabled={createAvatar.isPending}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 disabled:opacity-50">
                      {createAvatar.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      Add as {currentPurpose?.label || "Avatar"}
                    </button>
                  )}

                  {/* Quick-add buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => {
                      if (!imageUrl || !user) { toast.error("Sign in to save"); return; }
                      createAvatar.mutate({
                        name: avatarName.trim() || "My Avatar",
                        purpose: "profile",
                        voice_style: selectedVoice,
                        personality: selectedPersonality,
                        image_url: imageUrl,
                        art_style: selectedStyle,
                        description: prompt.trim() || null,
                        is_default: true,
                      }, { onSuccess: () => toast.success("Set as profile avatar!") });
                    }} disabled={createAvatar.isPending}
                      className="py-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-medium flex items-center justify-center gap-1.5 hover:border-purple-500/60 transition-all disabled:opacity-50">
                      <UserPlus className="w-3.5 h-3.5" /> Use as Profile Avatar
                    </button>
                    <button onClick={() => {
                      if (!imageUrl || !user) { toast.error("Sign in to save"); return; }
                      createAvatar.mutate({
                        name: avatarName.trim() || "AI Partner",
                        purpose: "partner",
                        voice_style: selectedVoice,
                        personality: selectedPersonality,
                        image_url: imageUrl,
                        art_style: selectedStyle,
                        description: prompt.trim() || null,
                        is_default: false,
                      }, {
                        onSuccess: () => {
                          toast.success(`"${avatarName.trim() || "AI Companion"}" added to chat!`);
                          navigate("/oracle");
                        },
                      });
                    }} disabled={createAvatar.isPending}
                      className="py-2.5 rounded-xl border border-pink-500/30 bg-pink-500/10 text-pink-300 text-xs font-medium flex items-center justify-center gap-1.5 hover:border-pink-500/60 transition-all disabled:opacity-50">
                      <Heart className="w-3.5 h-3.5" /> Add to AI Friends
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={downloadImage} className="flex-1 py-2 rounded-xl border border-gray-700 text-gray-300 text-sm flex items-center justify-center gap-1.5">
                      <Download className="w-4 h-4" /> Download
                    </button>
                    <button onClick={() => { setImageUrl(null); setPrompt(""); }} className="flex-1 py-2 rounded-xl border border-gray-700 text-gray-300 text-sm flex items-center justify-center gap-1.5">
                      🔄 New Avatar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {imageUrl && !showCamera && (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Avatar Summary</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-300"><span className="text-gray-500">Name</span><span>{avatarName.trim() || "Unnamed"}</span></div>
                  <div className="flex justify-between text-gray-300"><span className="text-gray-500">Purpose</span><span>{currentPurpose?.label}</span></div>
                  {showVoiceAndPersonality && <div className="flex justify-between text-gray-300"><span className="text-gray-500">Voice</span><span>{selectedVoice}</span></div>}
                  {purpose === "partner" && <div className="flex justify-between text-gray-300"><span className="text-gray-500">Personality</span><span>{selectedPersonality}</span></div>}
                  {isPaidPurpose && <div className="flex justify-between text-amber-400 font-medium pt-1 border-t border-gray-800"><span>Cost</span><span>{currentPurpose?.price}</span></div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <MediaPickerDialog
        open={showMediaPicker}
        onOpenChange={setShowMediaPicker}
        filterType="image"
        title="Use Image from Library"
        onSelect={(url) => { setImageUrl(url); toast.success("Image loaded from library!"); }}
      />
    </div>
  );
};

export default AvatarGeneratorPage;
