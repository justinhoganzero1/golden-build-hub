// Oracle Control Bus — gives the Oracle full operator control over every page.
//
// 1. Massive ROUTE_REGISTRY mapping spoken phrases → in-app paths.
// 2. resolveOracleCommand() parses any user utterance into a structured intent.
// 3. executeOracleCommand() runs nav/click/fill/scroll/back actions globally.
// 4. A page-level component <OracleControlListener/> mounts once in App.tsx
//    and listens for "oracle:control" CustomEvents so the Oracle can drive any
//    page even when the user is not on /oracle.
//
// Marker syntax the Oracle can emit in chat:
//   [[NAV /path]]                         — navigate
//   [[NAV /path?q=foo]]                   — navigate with query
//   [[CLICK selector]]                    — click any visible element
//   [[FILL selector::value]]              — fill an input
//   [[SCROLL up|down|top|bottom]]         — scroll the viewport
//   [[BACK]]                              — history.back()
//   [[OPEN https://...]]                  — open external URL in a new tab

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export interface OracleRoute {
  label: string;
  path: string;
  // Aliases (lowercased substrings) the Oracle can match against the user's
  // utterance. The first hit wins.
  aliases: string[];
}

// One row per real route in App.tsx. Aliases are the spoken / typed names.
export const ROUTE_REGISTRY: OracleRoute[] = [
  { label: "Dashboard", path: "/dashboard", aliases: ["dashboard", "home screen", "home", "main menu", "modules", "grid"] },
  { label: "Oracle", path: "/oracle", aliases: ["oracle", "talk to you", "chat with you"] },
  { label: "App Builder", path: "/app-builder", aliases: ["app builder", "build an app", "make an app", "build apps", "make apps", "ai coder", "code builder"] },
  { label: "AI Coder", path: "/ai-coder", aliases: ["ai coder", "coder"] },
  { label: "AI App Builder", path: "/ai-app-builder", aliases: ["ai app builder"] },
  { label: "3D App Builder", path: "/ai-3d-app-builder", aliases: ["3d app builder", "three d app builder"] },
  { label: "Media Library", path: "/media-library", aliases: ["media library", "my library", "library", "saved files", "saved media", "saved images", "my files", "my photos", "my videos"] },
  { label: "Public Library", path: "/library/public", aliases: ["public library", "creators shop", "shop", "marketplace", "browse creators"] },
  { label: "Live Vision", path: "/live-vision", aliases: ["live vision", "camera", "see through", "look at this", "scan this", "what am i looking at"] },
  { label: "Photography Hub", path: "/photography-hub", aliases: ["photography hub", "photo studio", "photo hub", "edit a photo", "picture editor", "photo editor"] },
  { label: "AI Photo Editor", path: "/ai-photo-editor", aliases: ["ai photo editor"] },
  { label: "Voice Studio", path: "/voice-studio", aliases: ["voice studio", "voice builder", "change your voice", "clone voice", "make a voice"] },
  { label: "AI Studio", path: "/ai-studio", aliases: ["ai studio", "ai team", "agents studio"] },
  { label: "Movie Studio Pro", path: "/movie-studio-pro", aliases: ["movie studio", "movie maker", "make a movie", "film studio"] },
  { label: "YouTube Show Studio", path: "/youtube-show-studio", aliases: ["youtube show", "youtube studio", "make a youtube show", "youtube show studio"] },
  { label: "Living GIF Studio", path: "/living-gif-studio", aliases: ["living gif", "living gif studio", "animated avatar", "gif studio"] },
  { label: "Video Editor", path: "/video-editor", aliases: ["video editor", "edit a video", "edit video"] },
  { label: "AI Video Generator", path: "/ai-video-generator", aliases: ["video generator", "ai video generator", "make a video"] },
  { label: "AI Music Generator", path: "/ai-music-generator", aliases: ["music generator", "make music", "compose music", "music maker"] },
  { label: "AI Image Generator", path: "/ai-image-generator-free", aliases: ["image generator", "ai image generator", "make an image"] },
  { label: "Diagnostics", path: "/diagnostics", aliases: ["diagnostics", "system doctor", "system check", "health check"] },
  { label: "Audio Diagnostics", path: "/diagnostics/audio", aliases: ["audio diagnostics", "audio check", "test microphone"] },
  { label: "Audio Filter", path: "/audio-filter", aliases: ["audio filter", "noise filter", "background noise", "noise cancel"] },
  { label: "Settings", path: "/settings", aliases: ["settings", "account settings", "preferences", "options"] },
  { label: "Profile", path: "/profile", aliases: ["profile", "my account", "my profile"] },
  { label: "Wallet", path: "/wallet", aliases: ["wallet", "payments", "bills", "payid", "bpay", "money", "credits", "balance"] },
  { label: "Subscribe", path: "/subscribe", aliases: ["subscribe", "subscription", "upgrade", "plans", "pricing", "go premium"] },
  { label: "Calendar", path: "/calendar", aliases: ["calendar", "diary", "schedule", "appointments", "life diary"] },
  { label: "Alarm Clock", path: "/alarm-clock", aliases: ["alarm", "alarm clock", "set an alarm", "wake me up"] },
  { label: "Story Writer", path: "/story-writer", aliases: ["story writer", "write a story", "write a poem", "author studio"] },
  { label: "Avatar Generator", path: "/avatar-generator", aliases: ["avatar generator", "make an avatar", "change your face", "generate an avatar"] },
  { label: "Avatar Gallery", path: "/avatar-gallery", aliases: ["avatar gallery", "my avatars", "avatar collection"] },
  { label: "Mind Hub", path: "/mind-hub", aliases: ["mind hub", "mental health", "mindfulness", "meditation"] },
  { label: "Crisis Hub", path: "/crisis-hub", aliases: ["crisis hub", "crisis support", "emergency help", "i need help now"] },
  { label: "AI Therapist", path: "/ai-therapist-free", aliases: ["ai therapist", "therapist", "therapy", "talk therapy"] },
  { label: "AI Life Coach", path: "/ai-life-coach-free", aliases: ["life coach", "ai life coach", "coach me"] },
  { label: "AI Fitness Coach", path: "/ai-fitness-coach-free", aliases: ["fitness coach", "ai fitness", "workout coach"] },
  { label: "AI Tutor", path: "/ai-tutor", aliases: ["ai tutor", "tutor", "teach me", "study help", "homework"] },
  { label: "Personal Assistant", path: "/personal-assistant", aliases: ["personal assistant", "secretary"] },
  { label: "Interpreter", path: "/interpreter", aliases: ["interpreter", "translator", "translate"] },
  { label: "Inventor", path: "/inventor", aliases: ["inventor", "invent something", "invention"] },
  { label: "Family Hub", path: "/family-hub", aliases: ["family hub", "family"] },
  { label: "Magic Hub", path: "/magic-hub", aliases: ["magic hub", "spells", "magic"] },
  { label: "Professional Hub", path: "/professional-hub", aliases: ["professional hub", "work hub", "business hub"] },
  { label: "Marketing Hub", path: "/marketing-hub", aliases: ["marketing hub", "marketing"] },
  { label: "Special Occasions", path: "/special-occasions", aliases: ["special occasions", "birthdays", "anniversaries"] },
  { label: "Elderly Care", path: "/elderly-care", aliases: ["elderly care", "senior care", "grandma mode", "grandpa mode"] },
  { label: "AI Companion", path: "/ai-companion", aliases: ["ai companion", "companion", "ai friend"] },
  { label: "AI Boyfriend", path: "/ai-boyfriend", aliases: ["ai boyfriend", "boyfriend"] },
  { label: "AI Girlfriend", path: "/ai-girlfriend", aliases: ["ai girlfriend", "girlfriend"] },
  { label: "AI Cooking Assistant", path: "/ai-cooking-assistant", aliases: ["cooking", "recipe", "ai cooking", "what's for dinner"] },
  { label: "AI Travel Planner", path: "/ai-travel-planner", aliases: ["travel planner", "plan a trip", "travel"] },
  { label: "AI Email Writer", path: "/ai-email-writer", aliases: ["email writer", "write an email", "compose email"] },
  { label: "AI Resume Builder", path: "/ai-resume-builder-free", aliases: ["resume", "resume builder", "cv", "build my resume"] },
  { label: "AI Interview Coach", path: "/ai-interview-coach", aliases: ["interview coach", "interview prep", "mock interview"] },
  { label: "AI Investor Pitch", path: "/ai-investor-pitch", aliases: ["investor pitch", "pitch deck", "elevator pitch"] },
  { label: "AI Business Idea Generator", path: "/ai-business-idea-generator", aliases: ["business idea", "startup idea", "business ideas"] },
  { label: "AI Logo Ideas", path: "/ai-logo-ideas", aliases: ["logo ideas", "logo generator", "make a logo"] },
  { label: "AI Tagline Generator", path: "/ai-tagline-generator", aliases: ["tagline", "slogan generator"] },
  { label: "AI Name Generator", path: "/ai-name-generator", aliases: ["name generator", "name ideas"] },
  { label: "AI Horoscope", path: "/ai-horoscope-free", aliases: ["horoscope", "astrology", "zodiac", "my stars"] },
  { label: "AI Relationship Advice", path: "/ai-relationship-advice", aliases: ["relationship advice", "love advice"] },
  { label: "Claims Assistant", path: "/claims-assistant", aliases: ["claims", "insurance claim", "claims assistant"] },
  { label: "POS Learn", path: "/pos-learn", aliases: ["pos learn", "point of sale training", "till training"] },
  { label: "Safety Center", path: "/safety-center", aliases: ["safety center", "safety", "report content"] },
  { label: "Personal Vault", path: "/personal-vault", aliases: ["personal vault", "my vault", "secrets"] },
  { label: "Vault", path: "/vault", aliases: ["vault"] },
  { label: "Welcome", path: "/welcome", aliases: ["welcome screen", "welcome page"] },
  { label: "Suggestion Box", path: "/suggestion-box", aliases: ["suggestion box", "feedback", "suggest a feature"] },
  { label: "Referral", path: "/referral", aliases: ["referral", "invite friends", "refer a friend"] },
  { label: "Owner Dashboard", path: "/owner-dashboard", aliases: ["owner dashboard", "admin dashboard", "admin panel", "ceo dashboard"] },
  { label: "Admin Editor", path: "/admin/editor", aliases: ["admin editor", "edit content"] },
  { label: "Free SEO Tools", path: "/free-seo-tools", aliases: ["seo tools", "seo"] },
  { label: "Investor", path: "/investor", aliases: ["investor", "investors page", "investor portal"] },
  { label: "Creators", path: "/creators", aliases: ["creators", "creator portal"] },
  { label: "About", path: "/about", aliases: ["about", "about us"] },
  { label: "Privacy Policy", path: "/privacy-policy", aliases: ["privacy policy", "privacy"] },
  { label: "Terms of Service", path: "/terms-of-service", aliases: ["terms", "terms of service", "tos"] },
];

export type OracleCommand =
  | { kind: "nav"; path: string; label: string }
  | { kind: "click"; selector: string }
  | { kind: "fill"; selector: string; value: string }
  | { kind: "scroll"; direction: "up" | "down" | "top" | "bottom" }
  | { kind: "back" }
  | { kind: "open"; url: string };

const NAV_VERBS = /\b(open|launch|start|use|run|go\s*to|take\s*me\s*to|show\s*me|bring\s*up|switch\s*to|jump\s*to|take\s*me|head\s*to|navigate\s*to|fire\s*up|load|pull\s*up)\b/i;

/** Resolve a free-text user utterance → a route, even without a verb. */
export function resolveOracleCommand(text: string): OracleCommand | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Marker form takes precedence so the LLM can always force-trigger a command.
  const navMarker = lower.match(/\[\[\s*nav\s+(\/[^\]\s]+)\s*\]\]/i);
  if (navMarker) {
    const path = navMarker[1];
    const route = ROUTE_REGISTRY.find(r => r.path === path.split("?")[0].split("#")[0]);
    return { kind: "nav", path, label: route?.label || path };
  }
  const clickMarker = text.match(/\[\[\s*click\s+(.+?)\s*\]\]/i);
  if (clickMarker) return { kind: "click", selector: clickMarker[1].trim() };
  const fillMarker = text.match(/\[\[\s*fill\s+(.+?)::([\s\S]+?)\s*\]\]/i);
  if (fillMarker) return { kind: "fill", selector: fillMarker[1].trim(), value: fillMarker[2].trim() };
  const scrollMarker = text.match(/\[\[\s*scroll\s+(up|down|top|bottom)\s*\]\]/i);
  if (scrollMarker) return { kind: "scroll", direction: scrollMarker[1].toLowerCase() as any };
  if (/\[\[\s*back\s*\]\]/i.test(text)) return { kind: "back" };
  const openMarker = text.match(/\[\[\s*open\s+(https?:\/\/[^\]\s]+)\s*\]\]/i);
  if (openMarker) return { kind: "open", url: openMarker[1] };

  // Natural language navigation
  const hasVerb = NAV_VERBS.test(lower);
  // Try aliases — first match wins. Without a verb we still match on phrases
  // like "go to wallet" but require at least the alias to appear.
  for (const route of ROUTE_REGISTRY) {
    for (const alias of route.aliases) {
      // word-boundary-ish check; allow multi-word aliases naturally.
      const re = new RegExp(`(?:^|[^a-z])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z])`, "i");
      if (re.test(lower) && (hasVerb || lower.startsWith(alias))) {
        return { kind: "nav", path: route.path, label: route.label };
      }
    }
  }

  // Imperatives without alias match
  if (/\bgo\s+back\b|\b(?:hit|press)\s+back\b/i.test(lower)) return { kind: "back" };
  if (/\bscroll\s+(up|down|top|bottom|to\s+the\s+top|to\s+the\s+bottom)\b/i.test(lower)) {
    const m = lower.match(/scroll\s+(?:to\s+the\s+)?(up|down|top|bottom)/i)!;
    return { kind: "scroll", direction: m[1] as any };
  }
  return null;
}

/** Dispatch a control event picked up by <OracleControlListener/>. */
export function dispatchOracleCommand(cmd: OracleCommand) {
  window.dispatchEvent(new CustomEvent("oracle:control", { detail: cmd }));
}

/** Strip oracle control markers from a text response so they don't show in chat. */
export function stripOracleMarkers(text: string): string {
  return text.replace(/\[\[\s*(?:nav|click|fill|scroll|back|open)[^\]]*\]\]/gi, "").trim();
}

function findElement(selector: string): HTMLElement | null {
  // Try as a standard CSS selector first.
  try {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) return el;
  } catch {}
  // Fallback: find by visible button/link/label text (case-insensitive).
  const needle = selector.toLowerCase().trim();
  const candidates = document.querySelectorAll<HTMLElement>("button, a, [role='button'], [role='tab'], [role='menuitem']");
  for (const el of Array.from(candidates)) {
    const txt = (el.innerText || el.getAttribute("aria-label") || "").toLowerCase().trim();
    if (txt && (txt === needle || txt.includes(needle))) return el;
  }
  return null;
}

/** Mount once at the App root so Oracle commands work on every page. */
export function OracleControlListener() {
  const navigate = useNavigate();
  useEffect(() => {
    const onCmd = (e: Event) => {
      const cmd = (e as CustomEvent).detail as OracleCommand | undefined;
      if (!cmd) return;
      try {
        switch (cmd.kind) {
          case "nav": {
            navigate(cmd.path);
            break;
          }
          case "click": {
            const el = findElement(cmd.selector);
            if (el) { el.click(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
            else toast.error(`Could not find: ${cmd.selector}`);
            break;
          }
          case "fill": {
            const el = findElement(cmd.selector) as (HTMLInputElement | HTMLTextAreaElement | null);
            if (el && ("value" in el)) {
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
                || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
              setter?.call(el, cmd.value);
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              el.focus();
            }
            break;
          }
          case "scroll": {
            const el = document.scrollingElement || document.documentElement;
            if (cmd.direction === "top") el.scrollTo({ top: 0, behavior: "smooth" });
            else if (cmd.direction === "bottom") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            else if (cmd.direction === "down") window.scrollBy({ top: window.innerHeight * 0.8, behavior: "smooth" });
            else if (cmd.direction === "up") window.scrollBy({ top: -window.innerHeight * 0.8, behavior: "smooth" });
            break;
          }
          case "back": history.back(); break;
          case "open": window.open(cmd.url, "_blank", "noopener,noreferrer"); break;
        }
      } catch (err) {
        console.error("[oracle:control] failed", err);
      }
    };
    window.addEventListener("oracle:control", onCmd as EventListener);
    return () => window.removeEventListener("oracle:control", onCmd as EventListener);
  }, [navigate]);
  return null;
}
