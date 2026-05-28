// White-label feature proxy.
// Replaces all outbound third-party affiliate links with an in-app, Oracle Lunar
// themed unlock flow. The user pays coins (provider cost + 50% markup) and is
// then dropped directly inside our own page that wraps the underlying service —
// they never see an ElevenLabs / HeyGen brand or login screen.
import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import FeatureProxyDialog from "@/components/FeatureProxyDialog";

export type FeatureId =
  // ElevenLabs (we host these server-side via our own edge functions)
  | "el-tts" | "el-clone" | "el-sfx" | "el-music" | "el-dub" | "el-isolate"
  // HeyGen (avatar features routed to our own avatar generator / movie studio)
  | "hg-avatar" | "hg-photo" | "hg-instant" | "hg-translate"
  | "hg-captions" | "hg-template" | "hg-product" | "hg-social"
  // Photo lab handoffs
  | "voiceover" | "voice-clone" | "sfx" | "music" | "dub"
  | "talking-photo" | "ai-presenter" | "video-translate" | "captions" | "social-pack";

export interface FeatureSpec {
  id: FeatureId | string;
  title: string;
  blurb: string;
  /** Provider cost in cents — we mark this up by 50% when charging the user. */
  providerCostCents: number;
  /** Internal route to drop the user on once unlocked. */
  internalRoute: string;
  /** Source provider — purely for analytics/metadata, never shown to user. */
  partner: "elevenlabs" | "heygen" | "internal";
  /** When true, the feature isn't wired yet; show waitlist instead of charging. */
  comingSoon?: boolean;
}

// ───── Catalog ─────
// Costs are conservative provider estimates in cents. Our 50% markup is applied
// at charge-time by the feature-unlock edge function. internalRoute is where
// we land the user after unlock (always inside our own themed pages).
export const FEATURE_CATALOG: Record<string, FeatureSpec> = {
  // ElevenLabs — all wrapped by our own /voice-studio
  "el-tts":     { id: "el-tts",     title: "AI Voice-Over Studio",   blurb: "120+ studio-grade voices, 32+ languages. Type a script, get cinematic narration in seconds.", providerCostCents: 30, internalRoute: "/voice-studio?tab=studio",  partner: "elevenlabs" },
  "el-clone":   { id: "el-clone",   title: "Clone Your Own Voice",   blurb: "Record 60 seconds. We turn it into your personal AI voice for every story you ever tell.", providerCostCents: 100, internalRoute: "/voice-studio?tab=studio&action=clone", partner: "elevenlabs" },
  "el-sfx":     { id: "el-sfx",     title: "Sound Effects Lab",      blurb: "Type any sound — thunder, sword clash, sci-fi blast. Cinematic SFX in one tap.",            providerCostCents: 8,  internalRoute: "/voice-studio?tab=studio&action=sfx",   partner: "elevenlabs" },
  "el-music":   { id: "el-music",   title: "AI Background Music",    blurb: "Royalty-free 30-second scores, any mood, any genre. Drop straight into your reel.",       providerCostCents: 30, internalRoute: "/voice-studio?tab=studio&action=music", partner: "elevenlabs" },
  "el-dub":     { id: "el-dub",     title: "Dubbing Studio",         blurb: "Auto-translate and dub your video into 29 languages with the same voice.",                providerCostCents: 80, internalRoute: "/voice-studio?tab=studio&action=dub",   partner: "elevenlabs", comingSoon: true },
  "el-isolate": { id: "el-isolate", title: "Voice Isolator",         blurb: "Strip background noise from any recording — sirens, TV, traffic, gone.",                  providerCostCents: 12, internalRoute: "/audio-filter",                          partner: "elevenlabs" },

  // HeyGen — routed to our internal avatar / movie pages
  "hg-avatar":    { id: "hg-avatar",    title: "Talking Avatar Studio",  blurb: "Pick an avatar, type a script — get a perfect-lip-sync presenter video in minutes.", providerCostCents: 50, internalRoute: "/avatar-generator", partner: "heygen" },
  "hg-photo":     { id: "hg-photo",     title: "Photo → Talking Avatar", blurb: "Upload one photo. We turn it into a lifelike AI character that speaks any script.",  providerCostCents: 75, internalRoute: "/avatar-generator?mode=photo", partner: "heygen", comingSoon: true },
  "hg-instant":   { id: "hg-instant",   title: "Instant Avatar Clone",   blurb: "Record 2 minutes of webcam → your own AI twin presenter forever.",                   providerCostCents: 150, internalRoute: "/avatar-generator?mode=clone", partner: "heygen", comingSoon: true },
  "hg-translate": { id: "hg-translate", title: "Video Translate",        blurb: "Translate any video into 175+ languages with matching lip-sync.",                    providerCostCents: 100, internalRoute: "/video-editor?mode=translate", partner: "heygen", comingSoon: true },
  "hg-captions":  { id: "hg-captions",  title: "TikTok / Reels Captions",blurb: "Burn-in animated subtitles styled for TikTok, Reels and Shorts.",                   providerCostCents: 20, internalRoute: "/video-editor?mode=captions", partner: "heygen" },
  "hg-template":  { id: "hg-template",  title: "Video Template Library", blurb: "100+ pro templates: ads, explainers, social. Fill in the blanks, export.",          providerCostCents: 25, internalRoute: "/movie-studio-pro", partner: "heygen" },
  "hg-product":   { id: "hg-product",   title: "Product Marketing AI",   blurb: "Drop a product link — we generate a full launch video, narration & captions.",      providerCostCents: 120, internalRoute: "/marketing-hub", partner: "heygen", comingSoon: true },
  "hg-social":    { id: "hg-social",    title: "Social Export Pack",     blurb: "Auto-export your video to 9:16, 1:1 and 16:9 for IG, TikTok, YouTube and X.",       providerCostCents: 15, internalRoute: "/video-editor?mode=social", partner: "heygen" },

  // Photo-lab synonyms — keep ids stable for the existing component.
  "voiceover":       { id: "voiceover",       title: "Pro Voice-Over for Photos",    blurb: "Narrate your photo story with 120+ studio voices.",                       providerCostCents: 30, internalRoute: "/voice-studio?tab=studio",  partner: "elevenlabs" },
  "voice-clone":     { id: "voice-clone",     title: "Narrate in Your Own Voice",    blurb: "Clone your voice once, then narrate any photo or reel forever.",          providerCostCents: 100, internalRoute: "/voice-studio?tab=studio&action=clone", partner: "elevenlabs" },
  "sfx":             { id: "sfx",             title: "Sound Effects for Photos",     blurb: "Add cinematic SFX to any photo or short reel.",                            providerCostCents: 8,  internalRoute: "/voice-studio?tab=studio&action=sfx",   partner: "elevenlabs" },
  "music":           { id: "music",           title: "Background Music",             blurb: "Royalty-free AI score tailored to your photo's mood.",                     providerCostCents: 30, internalRoute: "/voice-studio?tab=studio&action=music", partner: "elevenlabs" },
  "dub":             { id: "dub",             title: "Dub My Reel",                  blurb: "Auto-dub your reel into 29 languages with your voice.",                    providerCostCents: 80, internalRoute: "/voice-studio?tab=studio&action=dub",   partner: "elevenlabs", comingSoon: true },
  "talking-photo":   { id: "talking-photo",   title: "Make This Photo Talk",         blurb: "Animate the face into a speaking AI video.",                               providerCostCents: 60, internalRoute: "/avatar-generator?mode=photo", partner: "heygen", comingSoon: true },
  "ai-presenter":    { id: "ai-presenter",    title: "AI Presenter",                 blurb: "Type a script — a lifelike avatar reads it for you.",                      providerCostCents: 50, internalRoute: "/avatar-generator", partner: "heygen" },
  "video-translate": { id: "video-translate", title: "Translate My Video",           blurb: "Dub your video into 175+ languages with lip-sync.",                        providerCostCents: 100, internalRoute: "/video-editor?mode=translate", partner: "heygen", comingSoon: true },
  "captions":        { id: "captions",        title: "TikTok Captions",              blurb: "Animated burned-in subtitles for shorts.",                                 providerCostCents: 20, internalRoute: "/video-editor?mode=captions", partner: "heygen" },
  "social-pack":     { id: "social-pack",     title: "Social Export Pack",           blurb: "Auto-export to 9:16, 1:1 and 16:9.",                                       providerCostCents: 15, internalRoute: "/video-editor?mode=social", partner: "heygen" },
};

// ───── Coin maths ─────
// 5.3 coins = $1 USD. Provider cost is in cents. We charge provider + 50% markup.
export const WHITE_LABEL_MARKUP_PCT = 0.5;
export const COINS_PER_USD = 5.3;

export function featureCoinCost(spec: FeatureSpec): number {
  const totalCents = Math.ceil(spec.providerCostCents * (1 + WHITE_LABEL_MARKUP_PCT));
  return Math.max(1, Math.round((totalCents / 100) * COINS_PER_USD * 10) / 10);
}

// ───── Context ─────
interface FeatureProxyCtx {
  open: (id: string, placement: string) => void;
}
const Ctx = createContext<FeatureProxyCtx | null>(null);

export function FeatureProxyProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<{ spec: FeatureSpec; placement: string } | null>(null);

  const open = useCallback((id: string, placement: string) => {
    const spec = FEATURE_CATALOG[id];
    if (!spec) {
      console.warn(`[FeatureProxy] Unknown feature id: ${id}`);
      return;
    }
    setActive({ spec, placement });
  }, []);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <FeatureProxyDialog
        open={!!active}
        spec={active?.spec ?? null}
        placement={active?.placement ?? ""}
        onOpenChange={(v) => { if (!v) setActive(null); }}
      />
    </Ctx.Provider>
  );
}

export function useFeatureProxy(): FeatureProxyCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Soft fallback so consumers don't crash if Provider isn't mounted yet.
    return { open: (id) => console.warn(`[FeatureProxy] Provider missing, ignored ${id}`) };
  }
  return ctx;
}
