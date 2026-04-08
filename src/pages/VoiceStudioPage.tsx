import { useState } from "react";
import { Music, Mic, Play, Square, Save, Wand2, Search, Globe, User, Volume2 } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";

interface VoiceProfile {
  id: string;
  name: string;
  gender: "Male" | "Female";
  accent: string;
  profession: string;
  style: string;
  preview: string;
}

const PROFESSIONS = [
  "News Anchor", "Poet", "Comedian", "Drill Sergeant", "Yoga Instructor", "Sports Commentator",
  "Jazz Singer", "Opera Singer", "Radio DJ", "Bartender", "Teacher", "Professor",
  "Doctor", "Nurse", "Lawyer", "Judge", "Queen's Counsel", "Politician",
  "Motivational Speaker", "Storyteller", "Librarian", "Chef", "Waiter",
  "Pilot", "Flight Attendant", "Truck Driver", "Taxi Driver", "Detective",
  "Police Officer", "Firefighter", "Paramedic", "Therapist", "Psychologist",
  "Farmer", "Gardener", "Gutter Sweeper", "Plumber", "Electrician",
  "Carpenter", "Architect", "Engineer", "Scientist", "Researcher",
  "Astronaut", "Marine Biologist", "Veterinarian", "Zoologist",
  "Historian", "Archaeologist", "Museum Curator", "Art Critic",
  "Fashion Designer", "Makeup Artist", "Hairdresser", "Personal Trainer",
  "Boxing Coach", "Surfer", "Skateboarder", "Rock Climber",
  "Monk", "Priest", "Imam", "Rabbi", "Shaman",
  "Fortune Teller", "Magician", "Circus Performer", "Street Artist",
  "Auctioneer", "Real Estate Agent", "Stock Broker", "Accountant",
  "Bank Manager", "Insurance Agent", "CEO", "Startup Founder",
  "Hacker", "Game Developer", "YouTuber", "Podcaster", "Blogger",
  "Journalist", "War Correspondent", "Diplomat", "Ambassador",
  "Navy Captain", "Army General", "Air Force Pilot",
  "Cowboy", "Rancher", "Miner", "Fisherman", "Sailor",
  "Butler", "Nanny", "Housekeeper", "Concierge",
  "Tour Guide", "Travel Blogger", "Backpacker",
  "Rapper", "Country Singer", "Blues Musician", "Classical Pianist",
  "Stand-up Comic", "Improv Actor", "Voice Actor", "Film Director",
  "Stunt Double", "Casting Director", "Talent Agent",
  "Wedding Planner", "Florist", "Bakery Owner", "Sommelier",
  "Barista", "Food Critic", "Nutritionist", "Dietitian",
  "Life Coach", "Career Counselor", "Social Worker", "Midwife",
  "Coroner", "Forensic Scientist", "Private Investigator",
  "Bouncer", "Bodyguard", "Security Guard",
  "Park Ranger", "Wildlife Photographer", "Storm Chaser",
  "Race Car Driver", "Motorcycle Mechanic", "Boat Captain",
  "Locksmith", "Tailor", "Cobbler", "Blacksmith", "Glassblower",
  "Beekeeper", "Dog Trainer", "Horse Whisperer",
  "Quantum Physicist", "Neurosurgeon", "Robotics Engineer",
];

const ACCENTS = [
  "American General", "Southern US", "New York", "Boston", "Texan",
  "British RP", "Cockney", "Scottish", "Irish", "Welsh",
  "Australian", "New Zealand", "South African",
  "French", "Italian", "Spanish", "German", "Russian",
  "Japanese", "Korean", "Mandarin", "Cantonese",
  "Hindi", "Arabic", "Brazilian Portuguese", "Mexican",
  "Jamaican", "Nigerian", "Kenyan", "Swedish", "Norwegian",
];

const VOICE_STYLES = [
  "Warm & Friendly", "Deep & Authoritative", "Soft & Gentle", "Raspy & Edgy",
  "Bright & Energetic", "Monotone & Robotic", "Sultry & Smooth", "Gruff & Tough",
  "Whispery & ASMR", "Booming & Theatrical", "Nasally & Quirky", "Husky & Mysterious",
  "Cheerful & Bubbly", "Calm & Meditative", "Sarcastic & Dry", "Passionate & Fiery",
];

const generateVoices = (): VoiceProfile[] => {
  const voices: VoiceProfile[] = [];
  const genders: ("Male" | "Female")[] = ["Male", "Female"];
  const names = {
    Male: ["James", "Oliver", "Raj", "Kenji", "Marcus", "Ahmed", "Lars", "Diego", "Ivan", "Kofi", "Chen", "Pierre", "Hans", "Liam", "Noah", "Ethan", "Kai", "Ravi", "Soren", "Mateo",
      "Bruno", "Felix", "Hugo", "Oscar", "Leo", "Axel", "Finn", "Rex", "Dante", "Zane", "Blake", "Troy", "Grant", "Clay", "Wade", "Jett", "Knox", "Cash", "Cruz", "Nash",
      "Reid", "Beau", "Cole", "Drew", "Grey", "Heath", "Lance", "Miles", "Quinn", "Shane"],
    Female: ["Sarah", "Luna", "Priya", "Yuki", "Amara", "Fatima", "Astrid", "Isabella", "Natasha", "Ama", "Mei", "Claire", "Greta", "Emma", "Ava", "Mia", "Zara", "Ananya", "Freya", "Sofia",
      "Vera", "Iris", "Jade", "Opal", "Ruby", "Pearl", "Ivy", "Fern", "Sage", "Wren", "Blair", "Dawn", "Eve", "Hope", "Joy", "Lake", "Mae", "Rain", "Sky", "Star",
      "Aria", "Cleo", "Dara", "Edie", "Faye", "Gwen", "Hana", "Isla", "June", "Kate"],
  };

  for (let i = 0; i < 120; i++) {
    const gender = genders[i % 2];
    const nameList = names[gender];
    voices.push({
      id: `voice-${i}`,
      name: nameList[i % nameList.length] + (Math.floor(i / nameList.length) > 0 ? ` ${String.fromCharCode(65 + Math.floor(i / nameList.length))}` : ""),
      gender,
      accent: ACCENTS[i % ACCENTS.length],
      profession: PROFESSIONS[i % PROFESSIONS.length],
      style: VOICE_STYLES[i % VOICE_STYLES.length],
      preview: `Hi, I'm a ${PROFESSIONS[i % PROFESSIONS.length].toLowerCase()} with a ${ACCENTS[i % ACCENTS.length]} accent.`,
    });
  }
  return voices;
};

const ALL_VOICES = generateVoices();

const VoiceStudioPage = () => {
  const [tab, setTab] = useState<"library" | "clone" | "create">("library");
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"All" | "Male" | "Female">("All");
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile | null>(null);
  const [recording, setRecording] = useState(false);
  const [cloneAccent, setCloneAccent] = useState(ACCENTS[0]);
  const [cloneLang, setCloneLang] = useState("English");
  const [playing, setPlaying] = useState<string | null>(null);

  const filteredVoices = ALL_VOICES.filter(v => {
    if (genderFilter !== "All" && v.gender !== genderFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return v.name.toLowerCase().includes(s) || v.profession.toLowerCase().includes(s) || v.accent.toLowerCase().includes(s) || v.style.toLowerCase().includes(s);
    }
    return true;
  });

  const playPreview = (voice: VoiceProfile) => {
    if (playing === voice.id) { window.speechSynthesis.cancel(); setPlaying(null); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(voice.preview);
    utter.rate = 0.9 + Math.random() * 0.3;
    utter.pitch = voice.gender === "Female" ? 1.1 + Math.random() * 0.3 : 0.7 + Math.random() * 0.3;
    utter.onend = () => setPlaying(null);
    setPlaying(voice.id);
    window.speechSynthesis.speak(utter);
  };

  const tabs = [
    { key: "library", label: "Voice Library", icon: <Volume2 className="w-4 h-4" /> },
    { key: "clone", label: "Clone Voice", icon: <Mic className="w-4 h-4" /> },
    { key: "create", label: "Custom Voice", icon: <Wand2 className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Music className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Voice Studio</h1><p className="text-muted-foreground text-xs">100+ unique voices • Clone • Create</p></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "library" && (
          <>
            <div className="flex gap-2 mb-3">
              <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-xl px-3">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search voices, professions, accents..." className="flex-1 bg-transparent text-sm text-foreground py-2 outline-none placeholder:text-muted-foreground" />
              </div>
              <select value={genderFilter} onChange={e => setGenderFilter(e.target.value as any)} className="bg-card border border-border rounded-xl px-3 text-xs text-foreground">
                <option>All</option><option>Male</option><option>Female</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{filteredVoices.length} voices found</p>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredVoices.slice(0, 50).map(v => (
                <div key={v.id} onClick={() => setSelectedVoice(v)} className={`flex items-center gap-3 bg-card border rounded-xl p-3 transition-all cursor-pointer ${selectedVoice?.id === v.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${v.gender === "Female" ? "bg-pink-500/10 text-pink-400" : "bg-blue-500/10 text-blue-400"}`}>
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{v.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{v.profession} • {v.accent} • {v.style}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); playPreview(v); }} className={`p-2 rounded-lg ${playing === v.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    {playing === v.id ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4 text-primary" />}
                  </button>
                </div>
              ))}
              {filteredVoices.length > 50 && <p className="text-center text-xs text-muted-foreground py-2">Showing 50 of {filteredVoices.length} — refine your search</p>}
            </div>
            {selectedVoice && (
              <div className="mt-4 bg-card border border-primary rounded-2xl p-4">
                <h3 className="text-sm font-bold text-primary mb-1">Selected: {selectedVoice.name}</h3>
                <p className="text-xs text-muted-foreground mb-3">{selectedVoice.gender} • {selectedVoice.accent} • {selectedVoice.profession}</p>
                <button onClick={() => { toast.success(`${selectedVoice.name} assigned as Oracle voice!`); }} className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                  Assign to Oracle
                </button>
              </div>
            )}
          </>
        )}

        {tab === "clone" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-sm font-bold text-foreground mb-2">Clone Your Voice</h3>
              <p className="text-xs text-muted-foreground mb-4">Record 30 seconds of your voice. We'll create a digital clone you can use with any accent or language.</p>
              <div className="h-20 flex items-center justify-center gap-[2px] mb-4">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className={`w-1 rounded-full bg-primary transition-all ${recording ? "animate-pulse" : ""}`} style={{ height: `${Math.random() * 60 + 20}%`, animationDelay: `${i * 50}ms` }} />
                ))}
              </div>
              <div className="flex justify-center mb-4">
                <button onClick={() => setRecording(!recording)} className={`p-5 rounded-full ${recording ? "bg-destructive" : "bg-primary"} text-primary-foreground`}>
                  {recording ? <Square className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
              </div>
              <p className="text-center text-xs text-muted-foreground">{recording ? "Recording... speak naturally" : "Tap to start recording"}</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Apply Accent to Clone</h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Accent</label>
                  <select value={cloneAccent} onChange={e => setCloneAccent(e.target.value)} className="w-full bg-input border border-border rounded-lg px-2 py-2 text-xs text-foreground">
                    {ACCENTS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Language</label>
                  <select value={cloneLang} onChange={e => setCloneLang(e.target.value)} className="w-full bg-input border border-border rounded-lg px-2 py-2 text-xs text-foreground">
                    {["English", "Spanish", "French", "German", "Italian", "Portuguese", "Japanese", "Korean", "Mandarin", "Hindi", "Arabic", "Russian", "Swedish", "Dutch", "Turkish", "Thai", "Vietnamese", "Greek", "Polish", "Czech"].map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => toast.success("Voice clone created!")} className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                Generate Cloned Voice
              </button>
            </div>
          </div>
        )}

        {tab === "create" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Build a Custom Voice</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Voice Name</label>
                  <input placeholder="e.g. Commander Rex" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Gender</label>
                    <select className="w-full bg-input border border-border rounded-lg px-2 py-2 text-xs text-foreground">
                      <option>Male</option><option>Female</option><option>Non-binary</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Age Range</label>
                    <select className="w-full bg-input border border-border rounded-lg px-2 py-2 text-xs text-foreground">
                      <option>Young (18-30)</option><option>Adult (30-50)</option><option>Mature (50-70)</option><option>Elder (70+)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Profession Style</label>
                  <select className="w-full bg-input border border-border rounded-lg px-2 py-2 text-xs text-foreground">
                    {PROFESSIONS.slice(0, 50).map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Accent</label>
                  <select className="w-full bg-input border border-border rounded-lg px-2 py-2 text-xs text-foreground">
                    {ACCENTS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Voice Style</label>
                  <select className="w-full bg-input border border-border rounded-lg px-2 py-2 text-xs text-foreground">
                    {VOICE_STYLES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <button onClick={() => toast.success("Custom voice created!")} className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                  <Wand2 className="w-4 h-4 inline mr-2" />Create Voice
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceStudioPage;
