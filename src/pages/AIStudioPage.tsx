import { useState, useEffect, useRef } from "react";
import { Sparkles, Plus, X, Search, Volume2, ChevronRight, Users, Mic, MessageCircle, Music } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CURATED_ELEVENLABS_VOICES } from "@/data/elevenLabsVoices";
import PaywallGate from "@/components/PaywallGate";
import LivingAvatar from "@/components/LivingAvatar";

// Realistic 8K avatar imports
import execMale from "@/assets/avatars/exec-male.jpg";
import scientistFemale from "@/assets/avatars/scientist-female.jpg";
import chefMale from "@/assets/avatars/chef-male.jpg";
import doctorFemale from "@/assets/avatars/doctor-female.jpg";
import artistMale from "@/assets/avatars/artist-male.jpg";
import devFemale from "@/assets/avatars/dev-female.jpg";
import teacherMale from "@/assets/avatars/teacher-male.jpg";
import builderMale from "@/assets/avatars/builder-male.jpg";
import astronautFemale from "@/assets/avatars/astronaut-female.jpg";
import heroMale from "@/assets/avatars/hero-male.jpg";
import wizardMale from "@/assets/avatars/wizard-male.jpg";
import pilotMale from "@/assets/avatars/pilot-male.jpg";
import singerFemale from "@/assets/avatars/singer-female.jpg";
import judgeMale from "@/assets/avatars/judge-male.jpg";
import mechanicMale from "@/assets/avatars/mechanic-male.jpg";
import vampireMale from "@/assets/avatars/vampire-male.jpg";
import cowboyMale from "@/assets/avatars/cowboy-male.jpg";
import ninjaMale from "@/assets/avatars/ninja-male.jpg";
import elfFemale from "@/assets/avatars/elf-female.jpg";
import mermaidFemale from "@/assets/avatars/mermaid-female.jpg";

// Realistic 8K avatar appearance options (replaces emoji choices)
const APPEARANCE_OPTIONS = [
  { id: "exec-male", label: "Executive", img: execMale },
  { id: "scientist-female", label: "Scientist", img: scientistFemale },
  { id: "chef-male", label: "Chef", img: chefMale },
  { id: "doctor-female", label: "Doctor", img: doctorFemale },
  { id: "artist-male", label: "Artist", img: artistMale },
  { id: "dev-female", label: "Engineer", img: devFemale },
  { id: "teacher-male", label: "Teacher", img: teacherMale },
  { id: "builder-male", label: "Builder", img: builderMale },
  { id: "astronaut-female", label: "Astronaut", img: astronautFemale },
  { id: "hero-male", label: "Hero", img: heroMale },
  { id: "wizard-male", label: "Wizard", img: wizardMale },
  { id: "pilot-male", label: "Pilot", img: pilotMale },
  { id: "singer-female", label: "Singer", img: singerFemale },
  { id: "judge-male", label: "Judge", img: judgeMale },
  { id: "mechanic-male", label: "Mechanic", img: mechanicMale },
  { id: "vampire-male", label: "Vampire", img: vampireMale },
  { id: "cowboy-male", label: "Cowboy", img: cowboyMale },
  { id: "ninja-male", label: "Ninja", img: ninjaMale },
  { id: "elf-female", label: "Elf", img: elfFemale },
  { id: "mermaid-female", label: "Mermaid", img: mermaidFemale },
];

const getAppearance = (id: string) => APPEARANCE_OPTIONS.find(a => a.id === id) || APPEARANCE_OPTIONS[0];

const ALL_FIELDS = [
  "Doctor", "Nurse", "Surgeon", "Dentist", "Pharmacist", "Paramedic", "Physiotherapist", "Psychologist", "Psychiatrist", "Veterinarian",
  "Lawyer", "Judge", "Politician", "Diplomat", "Police Officer", "Detective", "FBI Agent", "Military Officer", "Barrister", "Solicitor",
  "Teacher", "Professor", "Tutor", "Librarian", "School Principal", "University Dean", "Language Teacher", "Music Teacher",
  "Software Engineer", "Data Scientist", "Cybersecurity Expert", "AI Researcher", "Game Developer", "Web Designer", "Robotics Engineer",
  "CEO", "Accountant", "Financial Advisor", "Stock Trader", "Real Estate Agent", "Marketing Manager", "Entrepreneur", "Banker",
  "Actor", "Director", "Musician", "Singer", "Dancer", "Comedian", "Painter", "Sculptor", "Photographer", "DJ", "Magician",
  "Plumber", "Electrician", "Carpenter", "Mechanic", "Welder", "Roofer", "Locksmith", "Landscaper",
  "Chef", "Baker", "Barista", "Sommelier", "Bartender", "Hotel Manager", "Food Critic", "Nutritionist",
  "Physicist", "Chemist", "Biologist", "Astronomer", "Geologist", "Marine Biologist", "Archaeologist", "Meteorologist",
  "Pilot", "Ship Captain", "Truck Driver", "Bus Driver", "Air Traffic Controller", "Logistics Manager",
  "Journalist", "News Anchor", "Podcast Host", "Blogger", "Influencer", "Graphic Designer", "Fashion Designer", "Architect",
  "Personal Trainer", "Professional Athlete", "Football Coach", "Yoga Instructor", "Boxing Coach", "Marathon Runner",
  "Life Coach", "Meditation Teacher", "Astrologer", "Tarot Reader", "Counsellor", "Therapist", "Chaplain",
  "Farmer", "Beekeeper", "Florist", "Wildlife Ranger", "Zookeeper",
  "Firefighter", "Coast Guard", "Postal Worker", "Park Ranger",
  "Stunt Performer", "Auctioneer", "Tattoo Artist", "Private Investigator", "Storm Chaser", "Voice Actor",
  "Navy SEAL", "Special Forces", "Bodyguard", "Intelligence Analyst",
  "Philosopher", "Historian", "Linguist", "Translator", "Author",
  "TikToker", "YouTuber", "Twitch Streamer", "App Developer", "UX Designer", "Startup Founder",
].filter((v, i, a) => a.indexOf(v) === i);

interface AvatarConfig {
  id: string;
  name: string;
  appearanceId: string;
  color: string;
  field: string;
  personality: string;
  voiceId: string; // ElevenLabs voice ID
  active: boolean;
  locked: boolean;
}

const COLOR_OPTIONS = ["#9b87f5", "#0EA5E9", "#D946EF", "#F97316", "#EAB308", "#22C55E", "#14B8A6", "#EF4444", "#8B5CF6", "#EC4899"];

const DEFAULT_AVATARS: AvatarConfig[] = [
  { id: "oracle", name: "Oracle", appearanceId: "wizard-male", color: "#9b87f5", field: "AI Researcher", personality: "Wise, all-knowing oracle", voiceId: "nPczCjzI2devNBz1zQrb", active: true, locked: false },
  { id: "luna", name: "Luna", appearanceId: "singer-female", color: "#D946EF", field: "Painter", personality: "Creative and artistic", voiceId: "EXAVITQu4vr4xnSDxMaL", active: false, locked: false },
  { id: "max", name: "Max", appearanceId: "dev-female", color: "#0EA5E9", field: "Software Engineer", personality: "Analytical and logical", voiceId: "CwhRBWXzGAHq8TQ4Fs17", active: false, locked: true },
  { id: "aria", name: "Aria", appearanceId: "doctor-female", color: "#22C55E", field: "Therapist", personality: "Empathetic and caring", voiceId: "FGY2WhTYpPnrIDTdsKH5", active: false, locked: true },
  { id: "spark", name: "Spark", appearanceId: "hero-male", color: "#F97316", field: "Comedian", personality: "Energetic and fun", voiceId: "IKne3meq5aSn9XLyUdCD", active: false, locked: true },
];

const AXEL_F_CACHE_KEY = "oracle-lunar-axel-f-mp3";

const AIStudioPage = () => {
  const navigate = useNavigate();
  const [avatars, setAvatars] = useState<AvatarConfig[]>(DEFAULT_AVATARS);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarConfig | null>(DEFAULT_AVATARS[0]);
  const [showCreator, setShowCreator] = useState(false);
  const [searchField, setSearchField] = useState("");
  const [voiceSearch, setVoiceSearch] = useState("");
  const [rotation, setRotation] = useState(0);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [musicOn, setMusicOn] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [newName, setNewName] = useState("");
  const [newAppearance, setNewAppearance] = useState(APPEARANCE_OPTIONS[0].id);
  const [newColor, setNewColor] = useState("#9b87f5");
  const [newField, setNewField] = useState("");
  const [newVoice, setNewVoice] = useState(CURATED_ELEVENLABS_VOICES[0].id);

  // Floating orbit animation
  useEffect(() => {
    const interval = setInterval(() => setRotation(prev => (prev + 0.3) % 360), 50);
    return () => clearInterval(interval);
  }, []);

  // Beverly Hills Cop "Axel F" background music while creator modal is open
  useEffect(() => {
    if (!showCreator || !musicOn) {
      musicRef.current?.pause();
      return;
    }
    const startMusic = async () => {
      try {
        let url = sessionStorage.getItem(AXEL_F_CACHE_KEY);
        if (!url) {
          toast.info("🎵 Cueing the retro synth groove...");
          const { data, error } = await supabase.functions.invoke("elevenlabs-music", {
            body: {
              prompt: "An upbeat funky 80s-style synth instrumental featuring a catchy synthesizer melody, retro electronic sounds, and a vibrant, danceable groove with no vocals.",
              duration_seconds: 60,
            },
          });
          if (error) throw error;
          // data may be a Blob (from invoke binary) or object
          const blob = data instanceof Blob ? data : new Blob([data], { type: "audio/mpeg" });
          url = URL.createObjectURL(blob);
          sessionStorage.setItem(AXEL_F_CACHE_KEY, url);
        }
        if (musicRef.current) {
          musicRef.current.src = url;
          musicRef.current.volume = 0.18; // soft so AI chat is still audible
          musicRef.current.loop = true;
          await musicRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("Music error:", err);
      }
    };
    startMusic();
    return () => { musicRef.current?.pause(); };
  }, [showCreator, musicOn]);

  const filteredFields = ALL_FIELDS.filter(f => f.toLowerCase().includes(searchField.toLowerCase()));
  const filteredVoices = CURATED_ELEVENLABS_VOICES.filter(v =>
    v.name.toLowerCase().includes(voiceSearch.toLowerCase()) ||
    v.accent.toLowerCase().includes(voiceSearch.toLowerCase()) ||
    v.description.toLowerCase().includes(voiceSearch.toLowerCase())
  );

  const previewVoice = async (voiceId: string, voiceName: string) => {
    if (previewingVoice === voiceId) return;
    setPreviewingVoice(voiceId);
    try {
      previewAudioRef.current?.pause();
      const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
        body: { text: `Hi, I'm ${voiceName}. I'd love to be your AI friend.`, voiceId },
      });
      if (error) throw error;
      const blob = data instanceof Blob ? data : new Blob([data], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewingVoice(null);
      await audio.play();
    } catch (err) {
      console.error(err);
      toast.error("Voice preview failed");
      setPreviewingVoice(null);
    }
  };

  const createAvatar = () => {
    if (!newName.trim() || !newField) {
      toast.error("Please enter a name and select a field");
      return;
    }
    const avatar: AvatarConfig = {
      id: Date.now().toString(),
      name: newName,
      appearanceId: newAppearance,
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
    toast.success(`${newName} the ${newField} created!`);
  };

  const selectForStage = (avatar: AvatarConfig) => {
    setSelectedAvatar(avatar);
  };

  const toggleActive = (id: string) => {
    const av = avatars.find(a => a.id === id);
    if (!av) return;
    setAvatars(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
    toast.success(av.active ? `${av.name} removed from chat` : `${av.name} added to chat`);
  };

  const orbitAvatars = avatars.filter(a => a.id !== selectedAvatar?.id);
  const voiceName = (vid: string) => CURATED_ELEVENLABS_VOICES.find(v => v.id === vid)?.name || "Voice";

  return (
    <PaywallGate requiredTier="starter" featureName="AI Studio (avatar &amp; voice creation)">
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <audio ref={musicRef} preload="auto" />
      <div className="px-4 pt-14 pb-4">
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

        {/* STAGE */}
        <div ref={stageRef} className="relative w-full aspect-square max-w-[320px] mx-auto mb-6">
          <div className="absolute inset-4 rounded-full border-2 border-dashed border-border/30" />
          {selectedAvatar && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center animate-scale-in">
              <div
                className="w-24 h-24 rounded-full overflow-hidden shadow-lg"
                style={{ border: `3px solid ${selectedAvatar.color}`, boxShadow: `0 0 30px ${selectedAvatar.color}40` }}
              >
                <LivingAvatar
                  imageUrl={getAppearance(selectedAvatar.appearanceId).img}
                  alt={selectedAvatar.name}
                />
              </div>
              <p className="mt-2 text-sm font-bold text-foreground">{selectedAvatar.name}</p>
              <p className="text-[10px] text-muted-foreground">{selectedAvatar.field}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => toggleActive(selectedAvatar.id)} className={`px-3 py-1 rounded-full text-[10px] font-medium ${selectedAvatar.active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                  {selectedAvatar.active ? "In Chat ✓" : "Add to Chat"}
                </button>
                <button onClick={() => previewVoice(selectedAvatar.voiceId, voiceName(selectedAvatar.voiceId))} className="px-3 py-1 rounded-full text-[10px] font-medium bg-secondary text-foreground flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> {voiceName(selectedAvatar.voiceId)}
                </button>
              </div>
            </div>
          )}
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
                  <div className="w-12 h-12 rounded-full overflow-hidden shadow-md hover:scale-110 transition-transform" style={{ border: `2px solid ${avatar.color}` }}>
                    <img src={getAppearance(avatar.appearanceId).img} alt={avatar.name} className="w-full h-full object-cover" loading="lazy" width={512} height={512} />
                    {avatar.locked && <span className="absolute -top-1 -right-1 text-xs">🔒</span>}
                  </div>
                  {avatar.active && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[hsl(var(--status-active))] border-2 border-background" />}
                </div>
                <p className="text-[8px] text-center text-muted-foreground mt-0.5 max-w-[50px] truncate">{avatar.name}</p>
              </button>
            );
          })}
        </div>

        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Active in Oracle Chat ({avatars.filter(a => a.active).length})
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {avatars.filter(a => a.active).map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-xl shrink-0" style={{ backgroundColor: a.color + "15", border: `1px solid ${a.color}30` }}>
                <img src={getAppearance(a.appearanceId).img} alt={a.name} className="w-7 h-7 rounded-full object-cover" loading="lazy" width={512} height={512} />
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

        <button onClick={() => navigate("/oracle")} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold mb-4 flex items-center justify-center gap-2">
          <MessageCircle className="w-5 h-5" /> Open Oracle Chat
        </button>

        <h2 className="text-sm font-semibold text-foreground mb-3">All AI Avatars ({avatars.length})</h2>
        <div className="space-y-2">
          {avatars.map(a => (
            <button key={a.id} onClick={() => selectForStage(a)} className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary transition-colors text-left">
              <div className="w-10 h-10 rounded-full overflow-hidden relative" style={{ border: `2px solid ${a.color}` }}>
                <img src={getAppearance(a.appearanceId).img} alt={a.name} className="w-full h-full object-cover" loading="lazy" width={512} height={512} />
                {a.locked && <span className="absolute -top-1 -right-1 text-[10px]">🔒</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{a.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{a.field} • {voiceName(a.voiceId)}</p>
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
              <div className="flex items-center gap-2">
                <button onClick={() => setMusicOn(m => !m)} className={`p-2 rounded-xl ${musicOn ? "bg-primary text-primary-foreground" : "bg-secondary"}`} title="Toggle Axel F theme">
                  <Music className="w-4 h-4" />
                </button>
                <button onClick={() => setShowCreator(false)} className="p-2 rounded-xl bg-secondary"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <label className="text-xs font-semibold text-foreground block mb-1">Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter avatar name..." className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm mb-4 outline-none focus:border-primary" />

            <label className="text-xs font-semibold text-foreground block mb-1">Appearance — 8K Realistic</label>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {APPEARANCE_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setNewAppearance(opt.id)} className={`relative aspect-square rounded-xl overflow-hidden transition-all ${newAppearance === opt.id ? "ring-2 ring-primary scale-105" : "opacity-80 hover:opacity-100"}`}>
                  <img src={opt.img} alt={opt.label} className="w-full h-full object-cover" loading="lazy" width={512} height={512} />
                  <span className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] text-foreground py-0.5 text-center">{opt.label}</span>
                </button>
              ))}
            </div>

            <label className="text-xs font-semibold text-foreground block mb-1">Theme Color</label>
            <div className="flex gap-2 mb-4 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => setNewColor(c)} className={`w-8 h-8 rounded-full ${newColor === c ? "ring-2 ring-offset-2 ring-primary" : ""}`} style={{ backgroundColor: c }} />
              ))}
            </div>

            <label className="text-xs font-semibold text-foreground block mb-1">Voice — ElevenLabs ({CURATED_ELEVENLABS_VOICES.length} options)</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={voiceSearch} onChange={e => setVoiceSearch(e.target.value)} placeholder="Search voices..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:border-primary" />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-card mb-4">
              {filteredVoices.map(v => (
                <div key={v.id} className={`flex items-center gap-2 px-3 py-2 border-b border-border/50 last:border-0 ${newVoice === v.id ? "bg-primary/10" : ""}`}>
                  <button onClick={() => setNewVoice(v.id)} className="flex-1 text-left">
                    <p className={`text-sm font-medium ${newVoice === v.id ? "text-primary" : "text-foreground"}`}>{v.name}</p>
                    <p className="text-[10px] text-muted-foreground">{v.gender} • {v.accent} • {v.description}</p>
                  </button>
                  <button onClick={() => previewVoice(v.id, v.name)} className="p-2 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors" title="Preview">
                    {previewingVoice === v.id ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
              {filteredVoices.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No matches.</p>}
            </div>

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
              {filteredFields.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No matches.</p>}
            </div>

            {newField && <p className="text-xs text-primary font-medium mb-4">Selected: {newField}</p>}

            <button onClick={createAvatar} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" /> Create {newName || "Avatar"}
            </button>
          </div>
        </div>
      )}
    </div>
    </PaywallGate>
  );
};

export default AIStudioPage;
