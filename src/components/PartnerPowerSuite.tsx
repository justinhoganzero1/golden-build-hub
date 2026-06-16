// PartnerPowerSuite — exposes every HeyGen + ElevenLabs capability we can route
// users to. Each feature is a clickable card that opens the partner with our
// affiliate link + tracks the placement. HeyGen cards auto-hide while the
// affiliate URL is still the placeholder.
import { Card } from "@/components/ui/card";
import {
  Mic, Music, Volume2, Languages, AudioLines, Headphones,
  Video, User, Sparkles, Globe, Subtitles, Share2, Wand2, Film, Camera, Megaphone,
} from "lucide-react";
import {
  ELEVENLABS_AFFILIATE_URL,
  HEYGEN_AFFILIATE_URL,
  trackAffiliateClick,
} from "@/lib/affiliateLinks";

const HEYGEN_PLACEHOLDER = "https://www.heygen.com/?sid=oraclelunar";

type Feature = {
  id: string;
  partner: "heygen" | "elevenlabs";
  icon: JSX.Element;
  title: string;
  desc: string;
  url: string;
};

const ALL_FEATURES: Feature[] = [
  // ───── ElevenLabs ─────
  { id: "el-tts",        partner: "elevenlabs", icon: <Mic className="w-4 h-4" />,        title: "AI Voice-Over",     desc: "Studio-grade narration in 32+ languages, 120+ voices.", url: ELEVENLABS_AFFILIATE_URL },
  { id: "el-clone",      partner: "elevenlabs", icon: <Headphones className="w-4 h-4" />, title: "Voice Cloning",     desc: "Clone your own voice from 60s of audio.",               url: ELEVENLABS_AFFILIATE_URL },
  { id: "el-sfx",        partner: "elevenlabs", icon: <Volume2 className="w-4 h-4" />,    title: "Sound Effects",     desc: "Generate any sound effect from a text prompt.",         url: ELEVENLABS_AFFILIATE_URL },
  { id: "el-music",      partner: "elevenlabs", icon: <Music className="w-4 h-4" />,      title: "AI Music",          desc: "Royalty-free background scores for any mood.",          url: ELEVENLABS_AFFILIATE_URL },
  { id: "el-dub",        partner: "elevenlabs", icon: <Languages className="w-4 h-4" />,  title: "Dubbing Studio",    desc: "Auto-dub your video into 29 languages.",                url: ELEVENLABS_AFFILIATE_URL },
  { id: "el-isolate",    partner: "elevenlabs", icon: <AudioLines className="w-4 h-4" />, title: "Voice Isolator",    desc: "Strip background noise from any recording.",            url: ELEVENLABS_AFFILIATE_URL },

  // ───── HeyGen ─────
  { id: "hg-avatar",     partner: "heygen", icon: <User className="w-4 h-4" />,    title: "Talking Avatar",       desc: "Lifelike AI presenter with perfect lip-sync.",          url: HEYGEN_AFFILIATE_URL },
  { id: "hg-photo",      partner: "heygen", icon: <Camera className="w-4 h-4" />,  title: "Photo Avatar",         desc: "Turn a single photo into a talking AI character.",      url: HEYGEN_AFFILIATE_URL },
  { id: "hg-instant",    partner: "heygen", icon: <Sparkles className="w-4 h-4" />,title: "Instant Avatar Clone", desc: "Clone yourself with 2 minutes of webcam video.",        url: HEYGEN_AFFILIATE_URL },
  { id: "hg-translate",  partner: "heygen", icon: <Globe className="w-4 h-4" />,   title: "Video Translate",      desc: "Translate your video into 175+ languages with lip-sync.", url: HEYGEN_AFFILIATE_URL },
  { id: "hg-captions",   partner: "heygen", icon: <Subtitles className="w-4 h-4" />,title: "Auto Captions",       desc: "Burn-in subtitles styled for TikTok / Reels / Shorts.", url: HEYGEN_AFFILIATE_URL },
  { id: "hg-template",   partner: "heygen", icon: <Wand2 className="w-4 h-4" />,   title: "Video Templates",      desc: "100+ pro templates for ads, explainers, social.",       url: HEYGEN_AFFILIATE_URL },
  { id: "hg-product",    partner: "heygen", icon: <Megaphone className="w-4 h-4" />,title: "Product Marketing",   desc: "Drop a product link → AI generates a full launch video.",url: HEYGEN_AFFILIATE_URL },
  { id: "hg-social",     partner: "heygen", icon: <Share2 className="w-4 h-4" />,  title: "Social Export",        desc: "9:16, 1:1, 16:9 ready for IG / TikTok / YouTube / X.",  url: HEYGEN_AFFILIATE_URL },
];

interface Props {
  /** Where this suite is rendered — used for click tracking */
  placementPrefix: string;
  /** Show only ElevenLabs, only HeyGen, or both */
  filter?: "all" | "heygen" | "elevenlabs";
  className?: string;
}

const PartnerPowerSuite = ({ placementPrefix, filter = "all", className = "" }: Props) => {
  const heygenLive = HEYGEN_AFFILIATE_URL !== HEYGEN_PLACEHOLDER;

  const features = ALL_FEATURES.filter((f) => {
    if (filter !== "all" && f.partner !== filter) return false;
    if (f.partner === "heygen" && !heygenLive) return false;
    return true;
  });

  if (features.length === 0) return null;

  const handleClick = (f: Feature) => {
    trackAffiliateClick(f.partner, `${placementPrefix}_${f.id}`);
    window.open(f.url, "_blank", "noopener,noreferrer,sponsored");
  };

  return (
    <Card className={`p-4 bg-gradient-to-br from-amber-950/30 via-background to-purple-950/20 border-amber-500/20 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Film className="w-5 h-5 text-amber-400" />
        <h3 className="text-sm font-bold text-foreground">Partner Power Suite</h3>
        <span className="ml-auto text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full">
          Pro upgrades
        </span>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Tap any tool to publish full social-ready videos using our preferred AI partners.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {features.map((f) => (
          <button
            key={f.id}
            onClick={() => handleClick(f)}
            className="text-left p-3 rounded-lg bg-background/40 border border-border/40 hover:border-amber-500/60 hover:bg-amber-500/5 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`p-1.5 rounded-md ${f.partner === "heygen" ? "bg-pink-500/15 text-pink-300" : "bg-blue-500/15 text-blue-300"}`}>
                {f.icon}
              </span>
              <span className="text-xs font-semibold text-foreground truncate">{f.title}</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{f.desc}</p>
            <p className="text-[9px] text-muted-foreground/50 mt-1 uppercase tracking-wide">
              via {f.partner === "heygen" ? "HeyGen" : "ElevenLabs"}
            </p>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">
        Sponsored partners — Oracle Lunar earns a commission on signups
      </p>
    </Card>
  );
};

export default PartnerPowerSuite;
