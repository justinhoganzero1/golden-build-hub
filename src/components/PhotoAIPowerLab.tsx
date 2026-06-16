// PhotoAIPowerLab — a giant grid of one-tap AI mini-tools that supercharge the
// 8K Photo Studio. Each preset feeds a polished prompt into the studio, picks
// a matching style filter, and sets the right mode (generate vs edit). Some
// tiles hand off to HeyGen / ElevenLabs for video & voice extensions.
import {
  Wand2, User, Briefcase, Sparkles, Camera, Star, Zap, Palette, Brush, Crown,
  Heart, Image as ImageIcon, ShoppingBag, BookOpen, Mountain, Car, Cake,
  Smile, Glasses, Clapperboard, Mic, Music, Languages, Volume2, Megaphone,
  Globe, Subtitles, Film, Headphones, Newspaper, Scissors, Ghost, Flame,
  Snowflake, Droplets, Sun, Moon, Sticker, Layers, PawPrint, Baby,
  Leaf, Rocket, Gem, Tag,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  ELEVENLABS_AFFILIATE_URL,
  HEYGEN_AFFILIATE_URL,
  trackAffiliateClick,
} from "@/lib/affiliateLinks";

const HEYGEN_PLACEHOLDER = "https://www.heygen.com/?sid=oraclelunar";

type PhotoMode = "generate" | "edit";
type Filter = "None" | "Vivid" | "Noir" | "Vintage" | "Dreamy" | "Cinematic";

interface Preset {
  id: string;
  group: "headshots" | "creative" | "products" | "lifestyle" | "fun" | "video" | "voice";
  icon: JSX.Element;
  title: string;
  desc: string;
  /** If undefined, the tile opens an external partner */
  prompt?: string;
  filter?: Filter;
  mode?: PhotoMode;
  /** Partner handoff */
  partner?: "heygen" | "elevenlabs";
}

const PRESETS: Preset[] = [
  // ───── Headshots & Portraits ─────
  { id: "linkedin",       group: "headshots", icon: <Briefcase className="w-4 h-4" />, title: "LinkedIn Headshot",     desc: "Studio-lit corporate portrait, neutral suit, soft backdrop.", prompt: "Professional LinkedIn headshot, soft studio lighting, neutral charcoal suit, blurred grey backdrop, confident warm smile, sharp eyes", filter: "Vivid", mode: "edit" },
  { id: "actor",          group: "headshots", icon: <Star className="w-4 h-4" />,      title: "Actor Headshot",        desc: "Hollywood-style 8x10, soft beauty light, intense gaze.",     prompt: "Hollywood actor headshot, beauty dish lighting, slight rim light, neutral background, intense eye contact, magazine-quality skin texture", filter: "Cinematic", mode: "edit" },
  { id: "exec",           group: "headshots", icon: <Crown className="w-4 h-4" />,      title: "CEO Cover Shot",        desc: "Forbes-style executive portrait.",                            prompt: "Forbes magazine cover executive portrait, dramatic Rembrandt lighting, dark navy backdrop, tailored suit, powerful confident pose", filter: "Cinematic", mode: "edit" },
  { id: "passport",       group: "headshots", icon: <User className="w-4 h-4" />,       title: "Passport / ID Photo",   desc: "Plain white background, ICAO compliant.",                     prompt: "Passport photo, plain white background, even lighting, neutral expression, eyes open, no shadows, ICAO compliant framing", filter: "None", mode: "edit" },
  { id: "tinder",         group: "headshots", icon: <Heart className="w-4 h-4" />,      title: "Dating Profile Pic",     desc: "Outdoor golden-hour lifestyle shot.",                         prompt: "Attractive dating profile photo outdoors at golden hour, candid genuine smile, slightly out-of-focus city background, warm flattering light", filter: "Vivid", mode: "edit" },
  { id: "school",         group: "headshots", icon: <BookOpen className="w-4 h-4" />,   title: "School Yearbook",       desc: "Classic blue marble backdrop.",                               prompt: "Classic school yearbook portrait, blue mottled studio backdrop, soft Rembrandt lighting, friendly genuine smile", filter: "Vintage", mode: "edit" },

  // ───── Creative & Artistic ─────
  { id: "anime",          group: "creative", icon: <Sparkles className="w-4 h-4" />,    title: "Anime Style",            desc: "Studio Ghibli / Makoto Shinkai vibe.",                        prompt: "Studio Ghibli anime style portrait, hand-painted look, expressive eyes, soft watercolor backdrop", filter: "Dreamy", mode: "edit" },
  { id: "pixar",          group: "creative", icon: <Smile className="w-4 h-4" />,        title: "Pixar 3D Character",    desc: "Stylized 3D animated character.",                             prompt: "Pixar-style 3D animated character portrait, large expressive eyes, soft subsurface skin, cinematic key light", filter: "Vivid", mode: "edit" },
  { id: "oil",            group: "creative", icon: <Brush className="w-4 h-4" />,        title: "Oil Painting",          desc: "Renaissance master portrait.",                                prompt: "Renaissance oil painting portrait in the style of Rembrandt, dramatic chiaroscuro, rich textured brushstrokes, museum-grade", filter: "Vintage", mode: "edit" },
  { id: "watercolor",     group: "creative", icon: <Droplets className="w-4 h-4" />,    title: "Watercolor",            desc: "Soft hand-painted aquarelle.",                                prompt: "Loose watercolor portrait, paper texture visible, soft pastel washes, ink line accents", filter: "Dreamy", mode: "edit" },
  { id: "comic",          group: "creative", icon: <Layers className="w-4 h-4" />,       title: "Comic Book Cover",      desc: "Marvel/DC inked-and-colored hero.",                           prompt: "Comic book cover art, bold ink outlines, halftone shading, dynamic lighting, action pose, dramatic logo space at top", filter: "Vivid", mode: "edit" },
  { id: "pop",            group: "creative", icon: <Palette className="w-4 h-4" />,      title: "Pop Art Warhol",        desc: "4-up Warhol style print.",                                    prompt: "Andy Warhol pop art quad-portrait, four bold complementary color schemes, screen-print look", filter: "Vivid", mode: "edit" },
  { id: "cyberpunk",      group: "creative", icon: <Zap className="w-4 h-4" />,           title: "Cyberpunk Neon",        desc: "Blade Runner neon street portrait.",                          prompt: "Cyberpunk neon portrait, rain-soaked Blade Runner street, magenta and cyan rim light, holographic billboards bokeh", filter: "Cinematic", mode: "edit" },
  { id: "fantasy",        group: "creative", icon: <Gem className="w-4 h-4" />,           title: "Epic Fantasy",          desc: "LOTR-style heroic portrait.",                                  prompt: "Epic fantasy character portrait, ornate armor, mystical glowing runes, cinematic Lord of the Rings lighting, painterly background", filter: "Cinematic", mode: "edit" },
  { id: "ghost",          group: "creative", icon: <Ghost className="w-4 h-4" />,         title: "Halloween Spooky",      desc: "Creepy gothic horror portrait.",                              prompt: "Halloween gothic horror portrait, candlelit, pale skin, dark shadowy backdrop, victorian dress, slight fog", filter: "Noir", mode: "edit" },

  // ───── Products & Brand ─────
  { id: "product-white",  group: "products", icon: <ShoppingBag className="w-4 h-4" />, title: "Product on White",      desc: "Amazon-grade white-background product.",                       prompt: "Studio product photography on pure white seamless background, soft top light, mild reflection underneath, ultra-sharp 8K e-commerce shot", filter: "Vivid", mode: "edit" },
  { id: "product-lifestyle", group: "products", icon: <Tag className="w-4 h-4" />,      title: "Product Lifestyle",     desc: "Hero shot in real environment.",                              prompt: "Lifestyle product hero shot in a beautifully styled real-world environment, shallow depth of field, magazine-grade composition", filter: "Cinematic", mode: "edit" },
  { id: "magazine",       group: "products", icon: <Newspaper className="w-4 h-4" />,    title: "Magazine Cover",        desc: "Vogue-style cover with title space.",                          prompt: "Vogue magazine cover composition, dramatic studio lighting, sharp pose, leave headroom for masthead and headline copy", filter: "Cinematic", mode: "edit" },
  { id: "billboard",      group: "products", icon: <Megaphone className="w-4 h-4" />,    title: "Billboard Hero Ad",     desc: "Wide-aspect outdoor advert composition.",                      prompt: "Hero outdoor billboard advertising composition, ultra-wide framing, bold subject placement, rich saturated colors, leave negative space for tagline", filter: "Vivid", mode: "edit" },
  { id: "label",          group: "products", icon: <Sticker className="w-4 h-4" />,      title: "Sticker / Logo",        desc: "Die-cut sticker-style icon.",                                  prompt: "Die-cut vinyl sticker design, thick white border, bold flat colors, slight drop shadow, on transparent-style background", filter: "Vivid", mode: "generate" },

  // ───── Lifestyle & Travel ─────
  { id: "travel",         group: "lifestyle", icon: <Mountain className="w-4 h-4" />,     title: "Travel Postcard",       desc: "Iconic landmark backdrop selfie.",                             prompt: "Iconic travel postcard composition, golden hour, world-famous landmark in the background, candid joyful expression", filter: "Vivid", mode: "edit" },
  { id: "supercar",       group: "lifestyle", icon: <Car className="w-4 h-4" />,           title: "Supercar Lifestyle",    desc: "Posing with a luxury car.",                                    prompt: "Luxury lifestyle supercar shot, Lamborghini parked on a Monaco street at sunset, owner posing casually, cinematic teal & orange grade", filter: "Cinematic", mode: "edit" },
  { id: "wedding",        group: "lifestyle", icon: <Cake className="w-4 h-4" />,          title: "Wedding Glam",          desc: "Romantic editorial wedding portrait.",                         prompt: "Editorial wedding portrait, soft natural window light, romantic film grain, elegant gown, tender candid moment", filter: "Dreamy", mode: "edit" },
  { id: "fitness",        group: "lifestyle", icon: <Flame className="w-4 h-4" />,          title: "Fitness / Athletic",    desc: "Sweat-glistening gym hero shot.",                              prompt: "Athletic fitness hero portrait, dramatic gym lighting, defined muscles with sweat glisten, shallow depth of field, magazine quality", filter: "Cinematic", mode: "edit" },
  { id: "winter",         group: "lifestyle", icon: <Snowflake className="w-4 h-4" />,      title: "Winter Wonderland",     desc: "Snowfall portrait, cozy knit.",                                prompt: "Winter wonderland portrait, gentle snowfall, soft cozy knit outfit, frosty breath visible, golden-hour back-light through pines", filter: "Dreamy", mode: "edit" },
  { id: "summer",         group: "lifestyle", icon: <Sun className="w-4 h-4" />,             title: "Tropical Beach",        desc: "Golden Bali beach lifestyle.",                                 prompt: "Tropical Bali beach lifestyle photo, sun-kissed skin, white sand, crystal water, palm leaves, golden-hour glow", filter: "Vivid", mode: "edit" },
  { id: "night",          group: "lifestyle", icon: <Moon className="w-4 h-4" />,            title: "Neon Nightlife",        desc: "Tokyo neon street portrait.",                                  prompt: "Tokyo neon nightlife street portrait, vibrant signage bokeh, rain reflections, stylish streetwear", filter: "Cinematic", mode: "edit" },

  // ───── Fun & Family ─────
  { id: "baby",           group: "fun", icon: <Baby className="w-4 h-4" />,                 title: "Baby Studio Portrait",   desc: "Soft pastel newborn shot.",                                    prompt: "Newborn baby studio portrait, soft pastel blanket, gentle window light, dreamy shallow focus", filter: "Dreamy", mode: "edit" },
  { id: "pet",            group: "fun", icon: <PawPrint className="w-4 h-4" />,            title: "Pet Royalty",            desc: "Pet dressed as a king or queen.",                              prompt: "Royal portrait of my pet wearing a velvet cape and golden crown, oil painting style, ornate baroque background", filter: "Vintage", mode: "edit" },
  { id: "couple",         group: "fun", icon: <Heart className="w-4 h-4" />,                title: "Couple Goals",            desc: "Romantic Polaroid-style couple shot.",                         prompt: "Romantic couple portrait, soft golden-hour film grain, candid laughter, slight Polaroid border", filter: "Vintage", mode: "edit" },
  { id: "old",            group: "fun", icon: <Glasses className="w-4 h-4" />,              title: "Age Me / Future Me",     desc: "See yourself 40 years older.",                                 prompt: "Photorealistic age progression of this person 40 years older, kept recognizable, soft natural light, dignified expression", filter: "None", mode: "edit" },
  { id: "young",          group: "fun", icon: <Leaf className="w-4 h-4" />,                  title: "Younger Me",             desc: "See yourself 20 years younger.",                               prompt: "Photorealistic age regression, this person 20 years younger, kept recognizable, soft natural light", filter: "None", mode: "edit" },
  { id: "astronaut",      group: "fun", icon: <Rocket className="w-4 h-4" />,                title: "Astronaut Hero",          desc: "On the moon in NASA suit.",                                    prompt: "Photorealistic astronaut portrait on the moon, NASA spacesuit, Earth rising in the background, dramatic sunlight", filter: "Cinematic", mode: "edit" },
  { id: "remove-bg",      group: "fun", icon: <Scissors className="w-4 h-4" />,              title: "Remove Background",       desc: "Clean cut-out, transparent style.",                            prompt: "Remove the background entirely, replace with a clean studio backdrop suitable for cut-out", filter: "None", mode: "edit" },
  { id: "any-bg",         group: "fun", icon: <ImageIcon className="w-4 h-4" />,             title: "Any Background",          desc: "Place me anywhere — describe it.",                              prompt: "Replace the background with: [describe your dream background here]. Keep the person sharp and naturally lit", filter: "Cinematic", mode: "edit" },

  // ───── Video & Voice handoffs (HeyGen + ElevenLabs) ─────
  { id: "talking-photo",  group: "video", icon: <Clapperboard className="w-4 h-4" />,        title: "Make This Photo Talk",    desc: "Animate the face into a speaking AI video.",                   partner: "heygen" },
  { id: "ai-presenter",   group: "video", icon: <User className="w-4 h-4" />,                 title: "AI Presenter",            desc: "Type a script → lifelike avatar reads it.",                    partner: "heygen" },
  { id: "video-translate",group: "video", icon: <Globe className="w-4 h-4" />,                title: "Translate My Video",      desc: "Dub a video into 175+ languages with lip-sync.",               partner: "heygen" },
  { id: "captions",       group: "video", icon: <Subtitles className="w-4 h-4" />,            title: "TikTok Captions",         desc: "Burned-in animated subtitles for shorts.",                     partner: "heygen" },
  { id: "social-pack",    group: "video", icon: <Film className="w-4 h-4" />,                  title: "Social Pack 9:16/1:1",    desc: "Auto-export to IG / TikTok / YouTube / X.",                    partner: "heygen" },
  { id: "voiceover",      group: "voice", icon: <Mic className="w-4 h-4" />,                   title: "Pro Voice-Over",          desc: "32+ languages, 120+ voices for your photo story.",            partner: "elevenlabs" },
  { id: "voice-clone",    group: "voice", icon: <Headphones className="w-4 h-4" />,            title: "Clone My Voice",          desc: "60s sample → narrate any photo in your voice.",                partner: "elevenlabs" },
  { id: "sfx",            group: "voice", icon: <Volume2 className="w-4 h-4" />,                title: "Sound Effects",            desc: "Generate any SFX from a text prompt.",                         partner: "elevenlabs" },
  { id: "music",          group: "voice", icon: <Music className="w-4 h-4" />,                  title: "AI Background Music",      desc: "Royalty-free score for your photo reel.",                      partner: "elevenlabs" },
  { id: "dub",            group: "voice", icon: <Languages className="w-4 h-4" />,              title: "Dub My Reel",              desc: "Auto-dub your reel into 29 languages.",                        partner: "elevenlabs" },
];

const GROUPS: { key: Preset["group"]; label: string; emoji: string; blurb: string }[] = [
  { key: "headshots", label: "Headshots & Portraits",      emoji: "📸", blurb: "LinkedIn, actor, dating, passport & more." },
  { key: "creative",  label: "Creative & Artistic",        emoji: "🎨", blurb: "Anime, oil paint, comic, cyberpunk." },
  { key: "products",  label: "Products & Brand",           emoji: "🛍️", blurb: "Amazon-style, magazine, billboards." },
  { key: "lifestyle", label: "Lifestyle & Travel",         emoji: "🌴", blurb: "Travel, supercars, beach, nightlife." },
  { key: "fun",       label: "Fun & Family",               emoji: "💖", blurb: "Babies, pets, couples, age-me." },
  { key: "video",     label: "Video Magic (HeyGen)",       emoji: "🎬", blurb: "Talking photos, AI presenters, dubs." },
  { key: "voice",     label: "Voice & Audio (ElevenLabs)", emoji: "🎙️", blurb: "Voice-overs, cloning, music, SFX." },
];

interface Props {
  /** Called when a photo preset is chosen — fills the studio inputs. */
  onApplyPreset: (p: { prompt: string; filter: Filter; mode: PhotoMode }) => void;
  className?: string;
}

const PhotoAIPowerLab = ({ onApplyPreset, className = "" }: Props) => {
  const heygenLive = HEYGEN_AFFILIATE_URL !== HEYGEN_PLACEHOLDER;

  const visible = PRESETS.filter(p => {
    if (p.partner === "heygen" && !heygenLive) return false;
    return true;
  });

  const handleClick = (p: Preset) => {
    if (p.partner) {
      const url = p.partner === "heygen" ? HEYGEN_AFFILIATE_URL : ELEVENLABS_AFFILIATE_URL;
      trackAffiliateClick(p.partner, `photo_lab_${p.id}`);
      window.open(url, "_blank", "noopener,noreferrer,sponsored");
      return;
    }
    if (p.prompt && p.filter && p.mode) {
      onApplyPreset({ prompt: p.prompt, filter: p.filter, mode: p.mode });
    }
  };

  return (
    <Card className={`p-4 holo-card border border-amber-500/20 bg-gradient-to-br from-amber-950/20 via-background to-purple-950/20 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg holo-bubble bg-amber-500/15">
          <Wand2 className="w-4 h-4 text-amber-300" />
        </div>
        <h3 className="text-sm font-bold text-foreground">AI Power Lab</h3>
        <span className="ml-auto text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full">
          {visible.length} tools
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Tap a folder to open it. Each folder groups one-tap presets that auto-fill the 8K Photo Studio.
      </p>

      <div className="space-y-2">
        {GROUPS.map(g => {
          const items = visible.filter(p => p.group === g.key);
          if (items.length === 0) return null;
          return (
            <details
              key={g.key}
              className="group/folder rounded-xl border border-amber-500/20 bg-background/30 overflow-hidden open:border-amber-500/50 open:bg-background/50 transition-colors"
            >
              <summary className="flex items-center gap-3 p-3 cursor-pointer list-none select-none hover:bg-amber-500/5">
                <span className="text-2xl leading-none" aria-hidden>{g.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground truncate">{g.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                      {items.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{g.blurb}</p>
                </div>
                <span className="text-amber-300 text-xs transition-transform group-open/folder:rotate-90">▶</span>
              </summary>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 pt-1">
                {items.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleClick(p)}
                    className="text-left p-3 rounded-lg holo-tile bg-background/40 border border-border/40 hover:border-amber-500/60 transition-colors group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`p-1.5 rounded-md ${
                        p.partner === "heygen" ? "bg-pink-500/15 text-pink-300"
                        : p.partner === "elevenlabs" ? "bg-blue-500/15 text-blue-300"
                        : "bg-amber-500/15 text-amber-300"
                      }`}>
                        {p.icon}
                      </span>
                      <span className="text-xs font-semibold text-foreground truncate">{p.title}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{p.desc}</p>
                    {p.partner && (
                      <p className="text-[9px] text-muted-foreground/60 mt-1 uppercase tracking-wide">
                        via {p.partner === "heygen" ? "HeyGen" : "ElevenLabs"}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </Card>
  );
};

export default PhotoAIPowerLab;
