import { useState, useRef } from "react";
import { Palette, Sparkles, Loader2, Camera, Download, UserPlus, Plus, Mic, Heart } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";

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
  { value: "oracle", label: "🔮 Main Oracle", desc: "Replace the Oracle's default appearance" },
  { value: "profile", label: "👤 My Profile", desc: "Use as your profile picture" },
  { value: "ai-friend", label: "🤖 AI Friend", desc: "Add as an AI companion in chat" },
  { value: "partner", label: "💕 Boyfriend / Girlfriend", desc: "A romantic AI companion with a custom personality" },
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
  const [searchParams] = useSearchParams();
  const isCreatingFriend = searchParams.get("friend") === "true";

  const [selectedStyle, setSelectedStyle] = useState("realistic-full");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  // New state for purpose, voice, personality
  const [purpose, setPurpose] = useState(isCreatingFriend ? "ai-friend" : "oracle");
  const [selectedVoice, setSelectedVoice] = useState("Warm & Friendly");
  const [selectedPersonality, setSelectedPersonality] = useState("Sweet & Caring");
  const [avatarName, setAvatarName] = useState("");

  const showVoiceAndPersonality = purpose === "ai-friend" || purpose === "partner";

  const generate = async () => {
    const desc = prompt.trim() || "a person";
    setIsLoading(true);
    try {
      const stylePrompts: Record<string, string> = {
        "realistic-portrait": `Ultra-photorealistic portrait headshot of ${desc}. Studio lighting, shallow depth of field, 8K quality, detailed skin texture.`,
        "realistic-full": `Ultra-photorealistic full body portrait of ${desc}. Studio lighting, clean dark background, 8K quality, hyper-detailed.`,
        "anime": `Anime style character art of ${desc}. Vibrant colors, detailed anime eyes, clean lines, professional anime illustration.`,
        "cartoon-3d": `3D Pixar-style cartoon character of ${desc}. Smooth render, vibrant, clean background, Disney quality.`,
        "comic-book": `Comic book hero illustration of ${desc}. Bold ink lines, dynamic pose, vivid colors, Marvel quality.`,
        "pixel-art": `Pixel art character of ${desc}. 32-bit style, detailed sprites, retro gaming aesthetic.`,
        "watercolor": `Watercolor portrait painting of ${desc}. Soft washes, artistic brushstrokes, elegant composition.`,
        "cyberpunk": `Cyberpunk character of ${desc}. Neon lighting, futuristic augmentations, rain-slicked, blade runner aesthetic.`,
        "fantasy": `Epic fantasy character of ${desc}. Magical atmosphere, detailed armor/robes, dramatic lighting.`,
        "chibi": `Cute chibi character of ${desc}. Big head, small body, adorable expression, kawaii style.`,
        "oil-painting": `Classical oil painting portrait of ${desc}. Renaissance style, rich colors, masterwork quality.`,
        "minimalist": `Minimalist flat design avatar of ${desc}. Clean geometric shapes, limited palette, modern.`,
      };
      const fullPrompt = stylePrompts[selectedStyle] || `Avatar of ${desc}`;

      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: fullPrompt }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Generation failed");
        return;
      }
      const data = await resp.json();
      if (data.images?.[0]?.image_url?.url) {
        setImageUrl(data.images[0].image_url.url);
        toast.success("Avatar generated!");
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

  const addAvatar = () => {
    if (!imageUrl) { toast.error("Generate or capture an avatar first"); return; }

    const name = avatarName.trim() || "My Avatar";

    switch (purpose) {
      case "oracle":
        toast.success(`"${name}" set as your Oracle's appearance!`);
        navigate("/oracle");
        break;
      case "profile":
        toast.success(`"${name}" set as your profile picture!`);
        navigate("/profile");
        break;
      case "ai-friend":
        toast.success(`"${name}" added as an AI Friend with ${selectedVoice} voice!`);
        navigate("/ai-studio");
        break;
      case "partner":
        toast.success(`"${name}" added as your AI Partner — ${selectedPersonality}, ${selectedVoice} voice 💕`);
        navigate("/ai-companion");
        break;
    }
  };

  return (
    <div className="min-h-screen pb-20" style={{ background: "#0f0f0f" }}>
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-purple-500/10"><Palette className="w-7 h-7 text-purple-400" /></div>
          <div>
            <h1 className="text-xl font-bold text-white">Avatar Generator</h1>
            <p className="text-gray-500 text-xs">Create & assign AI-powered avatars</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left - Controls */}
          <div className="space-y-4">
            {/* Avatar Purpose */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> What is this avatar for?
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {AVATAR_PURPOSES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPurpose(p.value)}
                    className={`text-left p-3 rounded-xl border transition-all text-xs ${
                      purpose === p.value
                        ? "border-purple-500 bg-purple-500/10 text-white"
                        : "border-gray-800 bg-[#0f0f0f] text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <div className="font-semibold text-sm mb-0.5">{p.label}</div>
                    <div className="text-[10px] opacity-70">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Name & Style */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-white">Design Your Avatar</h2>

              {/* Name */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Avatar Name</label>
                <input
                  value={avatarName}
                  onChange={e => setAvatarName(e.target.value)}
                  placeholder="e.g. Luna, Shadow, Alex..."
                  className="w-full bg-[#0f0f0f] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500"
                />
              </div>

              {/* Style */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Style</label>
                <select
                  value={selectedStyle}
                  onChange={e => setSelectedStyle(e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white appearance-none cursor-pointer"
                >
                  {STYLES.map(s => (
                    <option key={s.value} value={s.value}>{s.label} - {s.desc}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Description</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Describe your avatar... e.g. a warrior princess with golden armor"
                  rows={3}
                  className="w-full bg-[#0f0f0f] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500 resize-none"
                />
              </div>

              {/* Generate / Selfie */}
              <button
                onClick={generate}
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:from-purple-500 hover:to-pink-500 transition-all"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Generate Avatar
              </button>
              <button
                onClick={takeSelfie}
                className="w-full py-2.5 rounded-xl border border-gray-700 text-purple-400 font-medium text-sm flex items-center justify-center gap-2 hover:border-purple-500 transition-colors"
              >
                <Camera className="w-4 h-4" /> Take a Selfie Instead
              </button>
            </div>

            {/* Voice & Personality — shown for AI Friend / Partner */}
            {showVoiceAndPersonality && (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Mic className="w-4 h-4 text-purple-400" /> Voice & Personality
                </h2>

                {/* Voice */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Voice Style</label>
                  <div className="flex flex-wrap gap-1.5">
                    {VOICE_OPTIONS.map(v => (
                      <button
                        key={v}
                        onClick={() => setSelectedVoice(v)}
                        className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                          selectedVoice === v
                            ? "bg-purple-600 text-white"
                            : "bg-[#0f0f0f] border border-gray-700 text-gray-400 hover:border-purple-500"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personality — only for partner */}
                {purpose === "partner" && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1">
                      <Heart className="w-3 h-3 text-pink-400" /> Personality
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PERSONALITY_OPTIONS.map(p => (
                        <button
                          key={p}
                          onClick={() => setSelectedPersonality(p)}
                          className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                            selectedPersonality === p
                              ? "bg-pink-600 text-white"
                              : "bg-[#0f0f0f] border border-gray-700 text-gray-400 hover:border-pink-500"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right - Preview & Add */}
          <div className="space-y-4">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white mb-3">Preview</h2>
              <div className="aspect-[3/4] rounded-xl bg-[#0f0f0f] border border-gray-800 overflow-hidden flex items-center justify-center">
                {showCamera ? (
                  <div className="relative w-full h-full">
                    <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                    <button onClick={captureSelfie} className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-white text-black font-medium text-sm">
                      📸 Capture
                    </button>
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

              {/* Action buttons */}
              {imageUrl && !showCamera && (
                <div className="flex flex-col gap-2 mt-4">
                  {/* Main ADD button */}
                  <button
                    onClick={addAvatar}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-base flex items-center justify-center gap-2 hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/20"
                  >
                    <Plus className="w-5 h-5" />
                    Add as {AVATAR_PURPOSES.find(p => p.value === purpose)?.label || "Avatar"}
                  </button>

                  <div className="flex gap-2">
                    <button onClick={downloadImage} className="flex-1 py-2 rounded-xl border border-gray-700 text-gray-300 text-sm flex items-center justify-center gap-1.5 hover:border-purple-500">
                      <Download className="w-4 h-4" /> Download
                    </button>
                    <button
                      onClick={() => { setImageUrl(null); setPrompt(""); }}
                      className="flex-1 py-2 rounded-xl border border-gray-700 text-gray-300 text-sm flex items-center justify-center gap-1.5 hover:border-red-500"
                    >
                      🔄 New Avatar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Summary card */}
            {imageUrl && !showCamera && (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Avatar Summary</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-500">Name</span>
                    <span>{avatarName.trim() || "Unnamed"}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-500">Purpose</span>
                    <span>{AVATAR_PURPOSES.find(p => p.value === purpose)?.label}</span>
                  </div>
                  {showVoiceAndPersonality && (
                    <div className="flex justify-between text-gray-300">
                      <span className="text-gray-500">Voice</span>
                      <span>{selectedVoice}</span>
                    </div>
                  )}
                  {purpose === "partner" && (
                    <div className="flex justify-between text-gray-300">
                      <span className="text-gray-500">Personality</span>
                      <span>{selectedPersonality}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarGeneratorPage;
