import { useState, useRef, useEffect } from "react";
import { MapPin, Mic, MicOff, Upload, Sparkles, Download, Share2, Wand2, Camera, RefreshCw, User } from "lucide-react";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAvatars } from "@/hooks/useUserAvatars";
import { useSaveMedia } from "@/hooks/useUserAvatars";
import { downloadFileFromUrl } from "@/lib/utils";
import ShareDialog from "@/components/ShareDialog";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

/**
 * TELEPORT — the never-before-done fusion of the Photo Maker and the AI Companion.
 *
 * You pick any photo of yourself (or one of your saved avatars). Your Oracle
 * companion then transports the SAME person — same face, same identity — into
 * ANY place, era, or scene of your choosing. Speak it or type it: "Paris rooftop
 * at sunset", "Mars surface", "1920s Berlin jazz club", "cover of Vogue".
 *
 * The photo is passed as an anchor image to Gemini's image-editing model with an
 * identity-lock prompt, so it's genuinely YOU in the new place — not a lookalike.
 */

// Curated destinations that showcase the concept immediately.
const PRESETS: { emoji: string; label: string; prompt: string }[] = [
  { emoji: "🗼", label: "Paris rooftop, sunset", prompt: "standing on a Parisian rooftop terrace at golden hour, Eiffel Tower glowing in the background, warm sunset light, elegant cinematic photo" },
  { emoji: "🌌", label: "Surface of Mars",        prompt: "walking on the red rocky surface of Mars in a sleek modern spacesuit, distant crimson dunes and Earth as a tiny blue dot in the sky, ultra realistic NASA style photo" },
  { emoji: "🎷", label: "1920s Berlin jazz club", prompt: "inside a smoky 1920s Berlin jazz club, art-deco lighting, dressed in period-perfect Roaring Twenties attire, sepia-toned cinematic photo" },
  { emoji: "🏯", label: "Ancient Kyoto temple",   prompt: "walking through a mist-covered ancient Kyoto temple courtyard at dawn, cherry blossoms falling, wearing subtly period-appropriate clothing, painterly cinematic photo" },
  { emoji: "🌆", label: "Cyberpunk Tokyo",        prompt: "standing in a neon-drenched cyberpunk Tokyo alleyway at night, holographic signs, rain-slicked streets reflecting pink and cyan lights, Blade-Runner style photo" },
  { emoji: "📸", label: "Cover of Vogue",         prompt: "high-fashion Vogue magazine cover shot, studio lighting, editorial pose, luxurious couture wardrobe, razor-sharp 8K fashion photography" },
  { emoji: "🏔", label: "Everest summit",          prompt: "at the summit of Mount Everest in full mountaineering gear, prayer flags whipping in the wind, sunrise over the Himalayas, epic National Geographic photo" },
  { emoji: "🏛", label: "Ancient Rome, Forum",     prompt: "standing in the ancient Roman Forum during its golden age, wearing period-authentic Roman attire, marble columns and citizens in the background, cinematic photo" },
  { emoji: "🌊", label: "Underwater with whales", prompt: "swimming underwater beside a massive humpback whale, sunbeams cutting through crystal-clear ocean, National Geographic underwater photography" },
  { emoji: "🚀", label: "Space station window",   prompt: "floating inside the International Space Station beside a giant cupola window, Earth curving below, wearing a NASA flight suit, ultra realistic photo" },
  { emoji: "🎬", label: "Old Hollywood premiere", prompt: "on the red carpet of a 1950s Old Hollywood movie premiere, black-and-white classic glamour, flashbulbs firing, timeless icon photo" },
  { emoji: "🏝", label: "Tropical private island", prompt: "on a pristine tropical private island beach at sunset, turquoise water, palm trees, luxury resort behind, dreamy travel-magazine photo" },
];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Tiny helper: turn a remote URL into a data URL so we can send it as inputImage
// even when the source bucket is private / signed / cross-origin.
async function urlToDataUrl(url: string): Promise<string> {
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) throw new Error(String(r.status));
    const blob = await r.blob();
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  } catch {
    return url; // fall back — image-gen will accept a URL too
  }
}

const TeleportPage = () => {
  const { user } = useAuth();
  const { data: myAvatars = [] } = useUserAvatars();
  const saveMedia = useSaveMedia();

  const [subjectDataUrl, setSubjectDataUrl] = useState<string | null>(null);
  const [subjectLabel, setSubjectLabel] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<{ url: string; where: string }[]>([]);
  const [listening, setListening] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);

  const avatarSubjects = myAvatars.filter((a: any) => a.image_url);

  // Voice dictation for the destination — hands-free "take me to…".
  const toggleMic = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice dictation isn't supported in this browser."); return; }
    if (listening) { try { recRef.current?.stop(); } catch { /* noop */ } setListening(false); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
    rec.onresult = (ev: any) => {
      const t = Array.from(ev.results).map((r: any) => r[0].transcript).join(" ").trim();
      setDestination(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try { rec.start(); recRef.current = rec; setListening(true); }
    catch { setListening(false); }
  };

  const pickAvatar = async (a: any) => {
    setSubjectLabel(a.name || "Your avatar");
    toast.info("Loading your photo…");
    const dataUrl = await urlToDataUrl(a.image_url);
    setSubjectDataUrl(dataUrl);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please pick an image file."); return; }
    if (f.size > 8 * 1024 * 1024) { toast.error("Photo must be under 8 MB."); return; }
    const dataUrl = await fileToDataUrl(f);
    setSubjectDataUrl(dataUrl);
    setSubjectLabel(f.name);
  };

  const teleport = async (whereOverride?: string) => {
    if (!user) { toast.error("Sign in first."); return; }
    if (!subjectDataUrl) { toast.error("Choose your photo first — upload one or pick a saved avatar."); return; }
    const where = (whereOverride || destination || "").trim();
    if (!where) { toast.error("Tell the Oracle where you want to appear."); return; }

    setIsGenerating(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error("Please sign in again."); return; }

      // Identity-lock prompt: keep the same person, only change the world.
      const prompt =
        `Teleport the exact same person from the input photo into a new scene. ` +
        `Preserve their face, hair, skin tone, age, gender, body type, and identity with absolute fidelity — ` +
        `this must clearly be the same person, not a lookalike. ` +
        `Adapt their wardrobe and pose naturally to fit the new environment. ` +
        `NEW SCENE: ${where}. ` +
        `Style: ultra-realistic 8K photograph, cinematic lighting, sharp focus, natural depth of field, ` +
        `feel like a real photo the person actually took at that place.`;

      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ prompt, inputImage: subjectDataUrl, tier: "premium" }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || `Teleport failed (${resp.status})`);
        return;
      }
      const data = await resp.json();
      const url = data.images?.[0]?.image_url?.url;
      if (!url) { toast.error("The Oracle couldn't render that scene — try another place."); return; }

      setResult(url);
      setHistory((h) => [{ url, where }, ...h].slice(0, 12));
      toast.success(`✨ You've been teleported to ${where.slice(0, 40)}${where.length > 40 ? "…" : ""}`);

      // Auto-save to Media Library so it lives in "All Creations" → "Teleport".
      saveMedia.mutate({
        media_type: "image",
        title: `Teleport → ${where.slice(0, 50)}${where.length > 50 ? "…" : ""}`,
        url,
        source_page: "teleport",
        metadata: {
          kind: "teleport",
          destination: where,
          subject_label: subjectLabel,
          rendered_at: new Date().toISOString(),
        },
      });
    } catch (e: any) {
      console.error("[teleport] error", e);
      toast.error(e?.message || "Teleport failed");
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-scroll new result into view.
  useEffect(() => {
    if (result) {
      const el = document.getElementById("teleport-result");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <SEO
        title="Teleport — Oracle Lunar"
        description="Send yourself anywhere. Your Oracle companion drops the real you into any place, era, or dream scene — same face, new world."
      />
      <UniversalBackButton />

      <div className="max-w-5xl mx-auto px-4 pt-20 pb-32">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3 h-3" /> New · Companion × Photo Maker
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-amber-400 to-primary bg-clip-text text-transparent mb-2">
            Teleport
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Pick a photo of yourself. Tell your Oracle where you want to appear.
            The <em>same you</em> — dropped into any place, era, or dream scene.
          </p>
        </div>

        {/* Step 1 — subject photo */}
        <section className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-5 md:p-6 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">1</div>
            <h2 className="text-lg font-semibold">Choose your photo</h2>
          </div>

          <div className="grid md:grid-cols-[220px,1fr] gap-4">
            {/* Preview */}
            <div className="aspect-square rounded-xl bg-muted/40 border border-border overflow-hidden flex items-center justify-center relative">
              {subjectDataUrl ? (
                <img src={subjectDataUrl} alt="You" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-muted-foreground text-xs px-4">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Your photo appears here
                </div>
              )}
              {subjectDataUrl && (
                <button
                  onClick={() => { setSubjectDataUrl(null); setSubjectLabel(""); }}
                  className="absolute top-2 right-2 bg-background/80 hover:bg-background border border-border rounded-full p-1"
                  title="Clear"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
                >
                  <Upload className="w-4 h-4" /> Upload a photo
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
                <Link
                  to="/avatar-generator"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 text-sm hover:bg-primary/10"
                >
                  <Wand2 className="w-4 h-4" /> Generate a new avatar
                </Link>
              </div>

              {avatarSubjects.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Or pick a saved avatar</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {avatarSubjects.slice(0, 12).map((a: any) => (
                      <button
                        key={a.id}
                        onClick={() => pickAvatar(a)}
                        className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border hover:border-primary transition"
                        title={a.name}
                      >
                        <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {subjectLabel && (
                <div className="text-xs text-muted-foreground">Using: <span className="text-foreground">{subjectLabel}</span></div>
              )}
            </div>
          </div>
        </section>

        {/* Step 2 — destination */}
        <section className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-5 md:p-6 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">2</div>
            <h2 className="text-lg font-semibold">Where do you want to go?</h2>
          </div>

          <div className="flex items-stretch gap-2 mb-3">
            <div className="flex-1 relative">
              <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Paris rooftop at sunset, Mars surface, 1920s jazz club…"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-background border border-border focus:border-primary outline-none text-sm"
                onKeyDown={(e) => { if (e.key === "Enter" && !isGenerating) teleport(); }}
              />
            </div>
            <button
              onClick={toggleMic}
              className={`px-3 rounded-lg border transition ${listening ? "bg-red-500 border-red-500 text-white animate-pulse" : "border-primary/30 hover:bg-primary/10"}`}
              title={listening ? "Stop" : "Speak destination"}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={() => teleport()}
              disabled={isGenerating || !subjectDataUrl || !destination.trim()}
              className="px-5 rounded-lg bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            >
              {isGenerating ? "Teleporting…" : "Teleport ✨"}
            </button>
          </div>

          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Or tap a place</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => { setDestination(p.prompt); teleport(p.prompt); }}
                disabled={isGenerating || !subjectDataUrl}
                className="text-xs px-3 py-1.5 rounded-full border border-primary/30 hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
        </section>

        {/* Result */}
        {(isGenerating || result) && (
          <section id="teleport-result" className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/5 to-transparent p-5 md:p-6 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" /> Your new photo
              </h2>
              {result && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadFileFromUrl(result, `teleport-${Date.now()}`)}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                  <button
                    onClick={() => setShareOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </button>
                </div>
              )}
            </div>

            <div className="relative aspect-square md:aspect-video rounded-xl bg-muted/40 overflow-hidden">
              {isGenerating && !result && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                  <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <div className="text-sm text-muted-foreground">
                    The Oracle is teleporting you to <span className="text-foreground font-medium">{destination}</span>…
                  </div>
                </div>
              )}
              {result && <img src={result} alt="Teleport result" className="w-full h-full object-contain" />}
            </div>
          </section>
        )}

        {/* History */}
        {history.length > 0 && (
          <section className="rounded-2xl border border-border bg-card/60 p-5 md:p-6">
            <h2 className="text-lg font-semibold mb-3">Recent teleports</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => setResult(h.url)}
                  className="group text-left"
                  title={h.where}
                >
                  <div className="aspect-square rounded-lg overflow-hidden border border-border group-hover:border-primary transition">
                    <img src={h.url} alt={h.where} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-xs mt-1.5 text-muted-foreground truncate">{h.where}</div>
                </button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-3">
              Every teleport is auto-saved to your <Link to="/media-library" className="text-primary hover:underline">Media Library</Link>.
            </div>
          </section>
        )}
      </div>

      {result && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          title={`Teleport → ${destination}`}
          url={result}
          imageUrl={result}
        />
      )}
    </div>
  );
};

export default TeleportPage;
