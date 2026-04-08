import { useState, useRef } from "react";
import { Palette, Sparkles, Loader2, Camera, Download, UserPlus } from "lucide-react";
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

  const styleObj = STYLES.find(s => s.value === selectedStyle) || STYLES[0];

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
    toast.success("Selfie captured! You can now use this as your avatar.");
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `solace-avatar-${Date.now()}.png`;
    a.click();
  };

  const saveAsFriend = () => {
    if (!imageUrl) { toast.error("Generate an avatar first"); return; }
    toast.success("Avatar saved as AI Friend! Go to AI Studio to configure.");
    navigate("/ai-studio");
  };

  return (
    <div className="min-h-screen pb-20" style={{ background: "#0f0f0f" }}>
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        {/* Create AI Friend banner */}
        {isCreatingFriend && (
          <div className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <UserPlus className="w-6 h-6 text-purple-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Create AI Friend</h3>
              <p className="text-xs text-gray-400">This avatar will be saved as a friend you can chat with!</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-purple-500/10"><Palette className="w-7 h-7 text-purple-400" /></div>
          <div>
            <h1 className="text-xl font-bold text-white">Avatar Generator</h1>
            <p className="text-gray-500 text-xs">Create AI-powered avatars</p>
          </div>
        </div>

        {/* Two column layout on larger screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left - Controls */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="w-5 h-5 text-gray-400" />
              <h2 className="text-sm font-bold text-white">Describe Your Avatar</h2>
            </div>

            {/* Style selector */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Style</label>
              <select
                value={selectedStyle}
                onChange={e => setSelectedStyle(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white appearance-none cursor-pointer"
              >
                {STYLES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}  - {s.desc}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Description</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe your avatar in detail... e.g. batman, a warrior princess, a cyberpunk hacker"
                rows={4}
                className="w-full bg-[#0f0f0f] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:from-purple-500 hover:to-pink-500 transition-all"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Generate Avatar
            </button>

            <div className="flex items-center gap-3 text-gray-600 text-xs">
              <div className="flex-1 h-px bg-gray-800" />
              <span>or</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            {/* Selfie button */}
            <button
              onClick={takeSelfie}
              className="w-full py-3 rounded-xl border border-gray-700 text-purple-400 font-medium flex items-center justify-center gap-2 hover:border-purple-500 transition-colors"
            >
              <Camera className="w-5 h-5" />
              Take a Selfie
            </button>
          </div>

          {/* Right - Preview */}
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
              <div className="flex gap-2 mt-3">
                <button onClick={downloadImage} className="flex-1 py-2 rounded-xl border border-gray-700 text-gray-300 text-sm flex items-center justify-center gap-1.5 hover:border-purple-500">
                  <Download className="w-4 h-4" /> Save
                </button>
                <button onClick={saveAsFriend} className="flex-1 py-2 rounded-xl bg-purple-600 text-white text-sm flex items-center justify-center gap-1.5">
                  <UserPlus className="w-4 h-4" /> Use as AI Friend
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarGeneratorPage;
