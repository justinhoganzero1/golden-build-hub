import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, Calendar, Clapperboard, Crown, Heart, MessageCircle, Palette, Sparkles, Wrench, Unlock } from "lucide-react";
import { moduleForPath, unlockEverything, unlockPaths, type DiscoverableModule } from "@/lib/oracleDiscovery";

type TopicId = "create" | "write" | "art" | "care" | "organise" | "build";
interface Topic { id: TopicId; label: string; icon: typeof Clapperboard; user: string; reply: string; paths: string[] }

// Free, pre-written welcome chat: no AI call, so brand-new members (even with
// an empty wallet) meet Oracle and unlock their apps straight away.
export const WELCOME_TOPICS: Topic[] = [
  { id: "create", label: "Make videos & movies", icon: Clapperboard, user: "I want to make videos and movies.",
    reply: "Ooh, I love that! I've opened Movie Studio, the Video Editor and YouTube Studio for you. Tell me your idea any time and we'll make it together.",
    paths: ["/movie-studio-pro", "/video-editor", "/youtube-show-studio"] },
  { id: "write", label: "Write stories & books", icon: BookOpen, user: "I'd love to write stories or a book.",
    reply: "A writer! Story Writer is open for you now. We can write a whole book together, chapter by chapter, and even get it ready for Kindle.",
    paths: ["/story-writer"] },
  { id: "art", label: "Photos, art & voices", icon: Palette, user: "I'm into photos, art and voices.",
    reply: "Beautiful. Photo Studio, Magic Hub, Avatar Gen and Voice Studio are all open now. You can even change how I look in my settings.",
    paths: ["/photography-hub", "/magic-hub", "/avatar-generator", "/voice-studio"] },
  { id: "care", label: "Look after my wellbeing", icon: Heart, user: "I want help looking after myself.",
    reply: "I'm right here for you. I've opened Mind Hub, Family Hub and Elderly Care, and the Crisis Hub is always there if things ever feel too heavy.",
    paths: ["/mind-hub", "/family-hub", "/elderly-care"] },
  { id: "organise", label: "Organise my day", icon: Calendar, user: "Help me organise my day.",
    reply: "Let's make life easier. Your Calendar, Alarm Clock, Occasions and Assistant are open now. Just tell me what's coming up and I'll help.",
    paths: ["/calendar", "/alarm-clock", "/special-occasions", "/personal-assistant"] },
  { id: "build", label: "Build an app or business", icon: Wrench, user: "I want to build an app or a business.",
    reply: "Big dreams, I like it! App Builder, Inventor and Pro Hub are ready for you. Tell me the idea and we'll shape it together.",
    paths: ["/app-builder", "/inventor", "/professional-hub"] },
];

interface Props {
  name?: string;
  userId?: string | null;
  /** Adds the exchange to the conversation and lets Oracle say her line. */
  onSay: (userLine: string, oracleLine: string) => void;
  onOpen: (path: string) => void;
  onLook: () => void;
  onTalk: () => void;
  onFounder: () => void;
  onClose: () => void;
}

export default function OracleWelcome({ name, userId, onSay, onOpen, onLook, onTalk, onFounder, onClose }: Props) {
  const [done, setDone] = useState<TopicId[]>([]);
  const [last, setLast] = useState<{ reply: string; opened: DiscoverableModule[] } | null>(null);

  const choose = (t: Topic) => {
    unlockPaths(userId, t.paths);
    // Show every module from this topic as openable, even ones unlocked earlier.
    const opened = t.paths.map(p => moduleForPath(p)).filter((m): m is DiscoverableModule => !!m);
    setDone(d => [...d, t.id]);
    setLast({ reply: t.reply, opened });
    onSay(t.user, t.reply);
  };
  const remaining = WELCOME_TOPICS.filter(t => !done.includes(t.id));

  return (
    <div role="dialog" aria-label="Welcome to Oracle Lunar" className="absolute inset-x-3 bottom-28 z-30 mx-auto max-h-[70%] max-w-md overflow-y-auto rounded-2xl border border-primary/40 bg-card/95 p-4 shadow-xl backdrop-blur">
      {!last ? (
        <p className="text-sm text-foreground">Hey{name ? ` ${name}` : " there"}, I'm Oracle 💛 Welcome to your new home. I'm your creative partner and best friend. What would you love to do first?</p>
      ) : (
        <>
          <p className="text-sm text-foreground">{last.reply}</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Unlocked apps">
            {last.opened.map(m => (
              <Button key={m.path} size="sm" onClick={() => { onClose(); onOpen(m.path); }}>
                <Unlock className="mr-1 h-3.5 w-3.5" />Open {m.label}
              </Button>
            ))}
            {done[done.length - 1] === "art" && <Button size="sm" variant="secondary" onClick={() => { onClose(); onLook(); }}><Palette className="mr-1 h-3.5 w-3.5" />Change my look</Button>}
          </div>
          {remaining.length > 0 && <p className="mt-4 text-xs text-muted-foreground">Anything else you'd like to try?</p>}
        </>
      )}
      <div className="mt-3 grid gap-2">
        {remaining.map(t => (
          <Button key={t.id} variant="secondary" className="justify-start" onClick={() => choose(t)}>
            <t.icon className="mr-2 h-4 w-4 text-primary" />{t.label}
          </Button>
        ))}
        <Button variant="outline" className="justify-start" onClick={() => { onClose(); onTalk(); }}>
          <MessageCircle className="mr-2 h-4 w-4 text-primary" />{last ? "Let's just chat now" : "Just talk with me"}
        </Button>
        {!last && (
          <Button variant="ghost" className="justify-start text-primary" onClick={() => { onClose(); onFounder(); }}>
            <Crown className="mr-2 h-4 w-4" />Claim my A$1 Founder seat
          </Button>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <button className="underline" onClick={() => { unlockEverything(userId); onClose(); }}><Sparkles className="mr-1 inline h-3 w-3" />Show me everything</button>
        <button className="underline" onClick={onClose}>{last ? "Done" : "Skip for now"}</button>
      </div>
    </div>
  );
}
