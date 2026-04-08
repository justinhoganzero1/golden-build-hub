import { useState, useEffect, useRef } from "react";
import { Sparkles, Plus, X, Search, Volume2, ChevronRight, Users, Mic, MessageCircle } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// 200+ profession/field categories
const ALL_FIELDS = [
  // Healthcare & Medicine
  "Doctor", "Nurse", "Surgeon", "Dentist", "Pharmacist", "Paramedic", "Physiotherapist", "Psychologist", "Psychiatrist", "Veterinarian", "Midwife", "Optometrist", "Radiologist", "Pathologist", "Dermatologist",
  // Law & Government
  "Lawyer", "Judge", "Politician", "Diplomat", "Police Officer", "Detective", "FBI Agent", "Military Officer", "Queen's Counsellor", "Barrister", "Solicitor", "Magistrate", "Senator", "Governor", "Mayor",
  // Education
  "Teacher", "Professor", "Tutor", "Librarian", "School Principal", "University Dean", "Kindergarten Teacher", "Special Education Teacher", "Language Teacher", "Music Teacher",
  // Technology
  "Software Engineer", "Data Scientist", "Cybersecurity Expert", "AI Researcher", "Game Developer", "Web Designer", "Network Engineer", "DevOps Engineer", "Blockchain Developer", "Robotics Engineer",
  // Business & Finance
  "CEO", "Accountant", "Financial Advisor", "Stock Trader", "Real Estate Agent", "Business Consultant", "Marketing Manager", "HR Manager", "Entrepreneur", "Venture Capitalist", "Banker", "Auditor", "Economist",
  // Arts & Entertainment
  "Actor", "Director", "Musician", "Singer", "Dancer", "Comedian", "Stand-Up Comic", "Painter", "Sculptor", "Photographer", "Film Producer", "Screenwriter", "Animator", "DJ", "Magician",
  // Trades & Manual
  "Plumber", "Electrician", "Carpenter", "Mechanic", "Welder", "Bricklayer", "Roofer", "Gutter Sweeper", "Chimney Sweep", "Glazier", "Tiler", "Plasterer", "Locksmith", "Painter & Decorator", "Landscaper",
  // Food & Hospitality
  "Chef", "Baker", "Barista", "Sommelier", "Bartender", "Hotel Manager", "Restaurant Owner", "Food Critic", "Nutritionist", "Dietitian",
  // Science & Research
  "Physicist", "Chemist", "Biologist", "Astronomer", "Geologist", "Marine Biologist", "Archaeologist", "Anthropologist", "Meteorologist", "Environmental Scientist",
  // Transport & Logistics
  "Pilot", "Ship Captain", "Truck Driver", "Bus Driver", "Train Driver", "Air Traffic Controller", "Logistics Manager", "Courier", "Taxi Driver", "Uber Driver",
  // Creative & Media
  "Journalist", "News Anchor", "Podcast Host", "Blogger", "Influencer", "Content Creator", "Graphic Designer", "Fashion Designer", "Interior Designer", "Architect",
  // Sports & Fitness
  "Personal Trainer", "Professional Athlete", "Football Coach", "Yoga Instructor", "Boxing Coach", "Nutritionist", "Sports Psychologist", "Referee", "Swimming Coach", "Marathon Runner",
  // Spiritual & Wellness
  "Life Coach", "Meditation Teacher", "Reiki Healer", "Astrologer", "Tarot Reader", "Counsellor", "Therapist", "Social Worker", "Chaplain", "Monk",
  // Agriculture & Nature
  "Farmer", "Rancher", "Beekeeper", "Fisherman", "Forester", "Botanist", "Florist", "Arborist", "Wildlife Ranger", "Zookeeper",
  // Public Service
  "Firefighter", "Paramedic", "Coast Guard", "Customs Officer", "Immigration Officer", "Prison Warden", "Postal Worker", "Garbage Collector", "Street Cleaner", "Park Ranger",
  // Unique & Unusual
  "Stunt Performer", "Fortune Teller", "Auctioneer", "Tattoo Artist", "Bounty Hunter", "Private Investigator", "Storm Chaser", "Treasure Hunter", "Ghost Hunter", "Snake Charmer",
  "Sword Swallower", "Circus Performer", "Rodeo Cowboy", "Professional Gamer", "Drone Pilot", "Space Engineer", "Toymaker", "Puppeteer", "Voice Actor", "Stuntman",
  // Military & Security
  "Navy SEAL", "Army Sergeant", "Marine", "Special Forces", "Security Guard", "Bodyguard", "Intelligence Analyst", "Bomb Disposal", "Sniper", "Combat Medic",
  // Philosophy & Thought
  "Philosopher", "Historian", "Political Analyst", "Futurist", "Ethicist", "Mythologist", "Cryptographer", "Linguist", "Translator", "Author",
  // Modern Digital
  "TikToker", "YouTuber", "Twitch Streamer", "NFT Artist", "Crypto Trader", "App Developer", "UX Designer", "SEO Specialist", "Digital Nomad", "Startup Founder",
].filter((v, i, a) => a.indexOf(v) === i); // dedupe

interface AvatarConfig {
  id: string;
  name: string;
  emoji: string;
  color: string;
  field: string;
  personality: string;
  voiceId: string;
  active: boolean;
  locked: boolean;
}

const VOICE_OPTIONS = [
  { id: "roger", name: "Roger (Deep)" },
  { id: "sarah", name: "Sarah (Warm)" },
  { id: "laura", name: "Laura (Soft)" },
  { id: "charlie", name: "Charlie (Energetic)" },
  { id: "george", name: "George (British)" },
  { id: "liam", name: "Liam (Friendly)" },
  { id: "alice", name: "Alice (Professional)" },
  { id: "matilda", name: "Matilda (Soothing)" },
  { id: "eric", name: "Eric (Casual)" },
  { id: "brian", name: "Brian (Authoritative)" },
];

const EMOJI_OPTIONS = ["🧑‍💼", "👩‍🔬", "🧑‍🍳", "👩‍⚕️", "🧑‍🎨", "👩‍💻", "🧑‍🏫", "👷", "🧑‍🚀", "🦸", "🧙", "🧑‍✈️", "👩‍🎤", "🧑‍⚖️", "🧑‍🔧", "🧛", "🤠", "🥷", "🧝", "🧜"];

const COLOR_OPTIONS = ["#9b87f5", "#0EA5E9", "#D946EF", "#F97316", "#EAB308", "#22C55E", "#14B8A6", "#EF4444", "#8B5CF6", "#EC4899"];

const DEFAULT_AVATARS: AvatarConfig[] = [
  { id: "oracle", name: "Oracle", emoji: "🔮", color: "#9b87f5", field: "AI Researcher", personality: "Wise, all-knowing oracle", voiceId: "george", active: true, locked: false },
  { id: "luna", name: "Luna", emoji: "🌙", color: "#9b87f5", field: "Painter", personality: "Creative and artistic", voiceId: "sarah", active: false, locked: false },
  { id: "max", name: "Max", emoji: "🤖", color: "#0EA5E9", field: "Software Engineer", personality: "Analytical and logical", voiceId: "roger", active: false, locked: true },
  { id: "aria", name: "Aria", emoji: "💜", color: "#D946EF", field: "Therapist", personality: "Empathetic and caring", voiceId: "laura", active: false, locked: true },
  { id: "spark", name: "Spark", emoji: "⚡", color: "#F97316", field: "Comedian", personality: "Energetic and fun", voiceId: "charlie", active: false, locked: true },
];

const AIStudioPage = () => {
  const navigate = useNavigate();
  const [avatars, setAvatars] = useState<AvatarConfig[]>(DEFAULT_AVATARS);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarConfig | null>(DEFAULT_AVATARS[0]);
  const [showCreator, setShowCreator] = useState(false);
  const [searchField, setSearchField] = useState("");
  const [rotation, setRotation] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  // Creator state
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🧑‍💼");
  const [newColor, setNewColor] = useState("#9b87f5");
  const [newField, setNewField] = useState("");
  const [newVoice, setNewVoice] = useState("roger");

  // Floating animation
  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.3) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const filteredFields = ALL_FIELDS.filter(f => f.toLowerCase().includes(searchField.toLowerCase()));

  const createAvatar = () => {
    if (!newName.trim() || !newField) {
      toast.error("Please enter a name and select a field");
      return;
    }
    const avatar: AvatarConfig = {
      id: Date.now().toString(),
      name: newName,
      emoji: newEmoji,
      color: newColor,
      field: newField,
      personality: `Expert ${newField} with stereotypical personality traits of that profession`,
      voiceId: newVoice,
      active: false,
      locked: false,
    };
    setAvatars(prev => [...prev, avatar]);
    setShowCreator(false);
    setNewName("");
    setNewField("");
    toast.success(`${newEmoji} ${newName} the ${newField} created!`);
  };

  const selectForStage = (avatar: AvatarConfig) => {
    if (avatar.locked) {
      toast("Unlock " + avatar.name + " for $1", {
        description: "Upgrade or pay $1 to add this AI friend.",
        action: { label: "View Plans", onClick: () => navigate("/subscribe") },
      });
      return;
    }
    setSelectedAvatar(avatar);
  };

  const toggleActive = (id: string) => {
    const av = avatars.find(a => a.id === id);
    if (!av) return;
    if (av.locked) {
      toast("Unlock for $1", { action: { label: "Subscribe", onClick: () => navigate("/subscribe") } });
      return;
    }
    setAvatars(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
    toast.success(av.active ? `${av.name} removed from chat` : `${av.name} added to chat`);
  };

  const orbitAvatars = avatars.filter(a => a.id !== selectedAvatar?.id);

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10"><Sparkles className="w-7 h-7 text-primary" /></div>
            <div>
              <h1 className="text-xl font-bold text-primary">AI Studio</h1>
              <p className="text-muted-foreground text-xs">Create & manage your AI avatars</p>
            </div>
          </div>
          <button onClick={() => setShowCreator(true)} className="p-2 rounded-xl bg-primary text-primary-foreground">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* STAGE AREA */}
        <div ref={stageRef} className="relative w-full aspect-square max-w-[320px] mx-auto mb-6">
          {/* Circular orbit track */}
          <div className="absolute inset-4 rounded-full border-2 border-dashed border-border/30" />

          {/* Center stage - selected avatar */}
          {selectedAvatar && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center animate-scale-in">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-lg"
                style={{ backgroundColor: selectedAvatar.color + "20", border: `3px solid ${selectedAvatar.color}`, boxShadow: `0 0 30px ${selectedAvatar.color}40` }}
              >
                {selectedAvatar.emoji}
              </div>
              <p className="mt-2 text-sm font-bold text-foreground">{selectedAvatar.name}</p>
              <p className="text-[10px] text-muted-foreground">{selectedAvatar.field}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => toggleActive(selectedAvatar.id)} className={`px-3 py-1 rounded-full text-[10px] font-medium ${selectedAvatar.active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                  {selectedAvatar.active ? "In Chat ✓" : "Add to Chat"}
                </button>
                <button className="px-3 py-1 rounded-full text-[10px] font-medium bg-secondary text-foreground flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> {VOICE_OPTIONS.find(v => v.id === selectedAvatar.voiceId)?.name.split(" ")[0]}
                </button>
              </div>
            </div>
          )}

          {/* Orbiting avatar bubbles */}
          {orbitAvatars.map((avatar, i) => {
            const angle = (rotation + (i * 360) / orbitAvatars.length) * (Math.PI / 180);
            const radius = 120;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <button
                key={avatar.id}
                onClick={() => selectForStage(avatar)}
                className="absolute left-1/2 top-1/2 z-20 transition-transform duration-100"
                style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
              >
                <div className="relative">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-md hover:scale-110 transition-transform"
                    style={{ backgroundColor: avatar.color + "20", border: `2px solid ${avatar.color}` }}
                  >
                    {avatar.emoji}
                    {avatar.locked && <span className="absolute -top-1 -right-1 text-xs">🔒</span>}
                  </div>
                  {avatar.active && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[hsl(var(--status-active))] border-2 border-background" />
                  )}
                </div>
                <p className="text-[8px] text-center text-muted-foreground mt-0.5 max-w-[50px] truncate">{avatar.name}</p>
              </button>
            );
          })}
        </div>

        {/* Active in chat section */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Active in Oracle Chat ({avatars.filter(a => a.active).length})
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {avatars.filter(a => a.active).map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-xl shrink-0" style={{ backgroundColor: a.color + "15", border: `1px solid ${a.color}30` }}>
                <span className="text-lg">{a.emoji}</span>
                <div>
                  <p className="text-xs font-medium text-foreground">{a.name}</p>
                  <p className="text-[9px] text-muted-foreground">{a.field}</p>
                </div>
                <button onClick={() => toggleActive(a.id)} className="ml-1"><X className="w-3 h-3 text-muted-foreground" /></button>
              </div>
            ))}
            {avatars.filter(a => a.active).length === 0 && (
              <p className="text-xs text-muted-foreground italic">No avatars in chat. Tap an avatar to add.</p>
            )}
          </div>
        </div>

        {/* Go to chat button */}
        <button onClick={() => navigate("/oracle")} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold mb-4 flex items-center justify-center gap-2">
          <MessageCircle className="w-5 h-5" /> Open Oracle Chat
        </button>

        {/* All Avatars list */}
        <h2 className="text-sm font-semibold text-foreground mb-3">All AI Avatars ({avatars.length})</h2>
        <div className="space-y-2">
          {avatars.map(a => (
            <button key={a.id} onClick={() => selectForStage(a)} className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary transition-colors text-left">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl relative" style={{ backgroundColor: a.color + "20", border: `2px solid ${a.color}` }}>
                {a.emoji}
                {a.locked && <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{a.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{a.field} • Voice: {VOICE_OPTIONS.find(v => v.id === a.voiceId)?.name.split(" ")[0]}</p>
              </div>
              <div className="flex items-center gap-2">
                {a.active && <div className="w-2 h-2 rounded-full bg-[hsl(var(--status-active))]" />}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Creator Modal */}
      {showCreator && (
        <div className="fixed inset-0 z-50 bg-background/95 overflow-y-auto">
          <div className="px-4 pt-6 pb-20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Create AI Avatar</h2>
              <button onClick={() => setShowCreator(false)} className="p-2 rounded-xl bg-secondary"><X className="w-5 h-5" /></button>
            </div>

            {/* Name */}
            <label className="text-xs font-semibold text-foreground block mb-1">Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter avatar name..." className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm mb-4 outline-none focus:border-primary" />

            {/* Emoji */}
            <label className="text-xs font-semibold text-foreground block mb-1">Appearance</label>
            <div className="flex gap-2 flex-wrap mb-4">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setNewEmoji(e)} className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${newEmoji === e ? "ring-2 ring-primary bg-primary/10" : "bg-secondary"}`}>{e}</button>
              ))}
            </div>

            {/* Color */}
            <label className="text-xs font-semibold text-foreground block mb-1">Theme Color</label>
            <div className="flex gap-2 mb-4">
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => setNewColor(c)} className={`w-8 h-8 rounded-full ${newColor === c ? "ring-2 ring-offset-2 ring-primary" : ""}`} style={{ backgroundColor: c }} />
              ))}
            </div>

            {/* Voice */}
            <label className="text-xs font-semibold text-foreground block mb-1">Voice</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {VOICE_OPTIONS.map(v => (
                <button key={v.id} onClick={() => setNewVoice(v.id)} className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 ${newVoice === v.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                  <Mic className="w-3 h-3" /> {v.name}
                </button>
              ))}
            </div>

            {/* Field / Profession */}
            <label className="text-xs font-semibold text-foreground block mb-1">Profession / Field of Knowledge ({ALL_FIELDS.length}+ options)</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={searchField} onChange={e => setSearchField(e.target.value)} placeholder="Search professions..." className="w-full pl-10 pr-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-card mb-4">
              {filteredFields.slice(0, 50).map(f => (
                <button key={f} onClick={() => setNewField(f)} className={`w-full text-left px-4 py-2.5 text-sm border-b border-border/50 last:border-0 ${newField === f ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-secondary"}`}>
                  {f}
                </button>
              ))}
              {filteredFields.length > 50 && <p className="text-[10px] text-muted-foreground text-center py-2">Scroll or search to see more...</p>}
              {filteredFields.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No matches. Try a different search.</p>}
            </div>

            {newField && (
              <p className="text-xs text-primary font-medium mb-4">Selected: {newField}</p>
            )}

            <button onClick={createAvatar} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" /> Create {newName || "Avatar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MessageCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
);

export default AIStudioPage;
