import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Play, Square, Save, Search, Sparkles, Trash2, UserPlus, Settings2, Loader2, RefreshCw, Crown } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSavedVoices, useSaveVoice, useDeleteSavedVoice, type SavedVoice } from "@/hooks/useSavedVoices";
import { useUserAvatars } from "@/hooks/useUserAvatars";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CURATED_ELEVENLABS_VOICES,
  type CuratedVoice,
  type VoiceSettings,
  DEFAULT_SETTINGS,
  PRESETS,
  MODELS,
  type PresetName,
} from "@/data/elevenLabsVoices";

interface AccountVoice {
  id: string;
  name: string;
  category: string;
  gender: string;
  accent: string;
  age: string;
  description: string;
  use_case: string;
}

type Tab = "library" | "saved" | "studio";
type GenderFilter = "All" | "Male" | "Female" | "Neutral";

const TTS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/elevenlabs-tts`;

export default function VoiceStudioPage() {
  const { user, session } = useAuth();
  const { data: savedVoices = [] } = useSavedVoices();
  const saveVoice = useSaveVoice();
  const deleteVoice = useDeleteSavedVoice();
  const { data: avatars = [] } = useUserAvatars();

  const [tab, setTab] = useState<Tab>("library");
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("All");
  const [accountVoices, setAccountVoices] = useState<AccountVoice[]>([]);
  const [loadingAccount, setLoadingAccount] = useState(false);

  // Studio state
  const [studioVoiceId, setStudioVoiceId] = useState<string>("nPczCjzI2devNBz1zQrb");
  const [studioVoiceName, setStudioVoiceName] = useState<string>("Brian");
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [text, setText] = useState("Hello — this is a preview of how this voice sounds in your app.");
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generating, setGenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Assign dialog
  const [assignVoice, setAssignVoice] = useState<SavedVoice | null>(null);

  // Load account voices on mount
  useEffect(() => {
    void loadAccountVoices();
  }, []);

  async function loadAccountVoices() {
    setLoadingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-voices");
      if (error) throw error;
      setAccountVoices((data?.voices || []) as AccountVoice[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAccount(false);
    }
  }

  // Merge curated + account, dedupe by id
  const allLibraryVoices: AccountVoice[] = useMemo(() => {
    const map = new Map<string, AccountVoice>();
    for (const v of CURATED_ELEVENLABS_VOICES) {
      map.set(v.id, { ...v, category: "premade" } as AccountVoice);
    }
    for (const v of accountVoices) {
      map.set(v.id, v);
    }
    return Array.from(map.values());
  }, [accountVoices]);

  const filteredVoices = useMemo(() => {
    const q = search.toLowerCase();
    return allLibraryVoices.filter((v) => {
      if (genderFilter !== "All") {
        const g = (v.gender || "").toLowerCase();
        if (genderFilter === "Male" && !g.includes("male") && g !== "m") return false;
        if (genderFilter === "Female" && !g.includes("female") && g !== "f") return false;
        if (genderFilter === "Neutral" && !["neutral", "non-binary", "androgynous", ""].some((x) => g.includes(x))) return false;
        if (genderFilter === "Male" && g.includes("female")) return false;
      }
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.accent || "").toLowerCase().includes(q) ||
        (v.description || "").toLowerCase().includes(q) ||
        (v.use_case || "").toLowerCase().includes(q)
      );
    });
  }, [allLibraryVoices, search, genderFilter]);

  function applyPreset(name: PresetName) {
    setSettings((s) => ({ ...s, ...PRESETS[name] }));
    toast.success(`${name} preset applied`);
  }

  async function generatePreview(voiceId: string, voiceName?: string) {
    if (!text.trim()) {
      toast.error("Type some text first");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ text, voiceId, settings, modelId: settings.model_id }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `TTS failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      await audio.play();
      if (voiceName) toast.success(`Playing ${voiceName}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setGenerating(false);
    }
  }

  function stopAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
  }

  function pickFromLibrary(v: AccountVoice) {
    setStudioVoiceId(v.id);
    setStudioVoiceName(v.name);
    setTab("studio");
  }

  function useCustomId() {
    if (!customVoiceId.trim()) {
      toast.error("Paste a voice ID first");
      return;
    }
    setStudioVoiceId(customVoiceId.trim());
    setStudioVoiceName("Custom Voice");
    setTab("studio");
    toast.success("Custom voice ID loaded");
  }

  async function handleSaveCurrent() {
    if (!user) {
      toast.error("Sign in to save voices");
      return;
    }
    try {
      await saveVoice.mutateAsync({
        name: studioVoiceName || "My Voice",
        gender: "Neutral",
        source: "elevenlabs",
        voice_config: { voice_id: studioVoiceId, settings },
      });
      toast.success("Voice saved");
    } catch (err) {
      toast.error("Could not save voice");
    }
  }

  async function handleAssignToAvatar(avatarId: string) {
    if (!assignVoice) return;
    try {
      const cfg = (assignVoice.voice_config || {}) as Record<string, unknown>;
      await supabase
        .from("user_avatars")
        .update({ voice_style: assignVoice.name })
        .eq("id", avatarId);
      // Persist voice id in localStorage for Oracle TTS
      if (typeof cfg.voice_id === "string") {
        localStorage.setItem("solace-oracle-voice", cfg.voice_id);
      }
      toast.success("Voice assigned");
      setAssignVoice(null);
    } catch (err) {
      toast.error("Could not assign voice");
    }
  }

  function setAsOracleMaster(voiceId: string, voiceName: string, voiceSettings?: VoiceSettings) {
    if (!voiceId) {
      toast.error("No voice ID available");
      return;
    }
    localStorage.setItem("solace-oracle-voice", voiceId);
    if (voiceSettings) {
      localStorage.setItem(
        "solace-oracle-voice-settings",
        JSON.stringify({
          stability: voiceSettings.stability,
          similarity_boost: voiceSettings.similarity_boost,
          style: voiceSettings.style,
          use_speaker_boost: voiceSettings.use_speaker_boost,
          speed: voiceSettings.speed,
        })
      );
    }
    toast.success(`👑 ${voiceName} is now the Oracle's master voice`);
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 pb-32">
      <UniversalBackButton />
      <div className="max-w-6xl mx-auto pt-12">
        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Sparkles className="text-primary" /> Voice Studio
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse the full voice library, fine-tune every setting, and assign voices to your avatars.
          </p>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          {(["library", "saved", "studio"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 capitalize transition-colors ${
                tab === t ? "border-b-2 border-primary text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "studio" ? "🎛 Studio" : t === "library" ? "🎙 Library" : "💾 Saved"}
            </button>
          ))}
        </div>

        {/* LIBRARY */}
        {tab === "library" && (
          <div>
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, accent, use case..."
                  className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={loadAccountVoices}
                disabled={loadingAccount}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-card/80 text-sm"
              >
                {loadingAccount ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                Refresh
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {(["All", "Male", "Female", "Neutral"] as GenderFilter[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGenderFilter(g)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    genderFilter === g
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="bg-card border border-border rounded-lg p-3 mb-4">
              <p className="text-xs text-muted-foreground mb-2">
                💡 Want more voices? Add them to your ElevenLabs account from the Voice Library, or paste any voice ID below.
              </p>
              <div className="flex gap-2">
                <input
                  value={customVoiceId}
                  onChange={(e) => setCustomVoiceId(e.target.value)}
                  placeholder="Paste ElevenLabs voice ID..."
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
                <button onClick={useCustomId} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                  Use ID
                </button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              {filteredVoices.length} voices • {accountVoices.length} from your account
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredVoices.map((v) => (
                <div key={v.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{v.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {[v.gender, v.accent, v.age].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">{v.category}</span>
                  </div>
                  {v.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{v.description}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => generatePreview(v.id, v.name)}
                      disabled={generating}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded text-xs font-medium hover:bg-primary/20"
                    >
                      <Play size={12} /> Preview
                    </button>
                    <button
                      onClick={() => pickFromLibrary(v)}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 bg-card border border-border rounded text-xs hover:border-primary"
                    >
                      <Settings2 size={12} /> Tune
                    </button>
                    <button
                      onClick={() => setAsOracleMaster(v.id, v.name, settings)}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-xs font-medium hover:bg-amber-500/20 ml-auto"
                      title="Set as Oracle's master voice"
                    >
                      <Crown size={12} /> Master
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SAVED */}
        {tab === "saved" && (
          <div>
            {savedVoices.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Mic className="mx-auto mb-3 opacity-50" size={48} />
                <p>No saved voices yet. Pick one from the Library and save it.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {savedVoices.map((v) => {
                  const cfg = (v.voice_config || {}) as Record<string, unknown>;
                  const vid = (cfg.voice_id as string) || "";
                  return (
                    <div key={v.id} className="bg-card border border-border rounded-lg p-4">
                      <h3 className="font-semibold">{v.name}</h3>
                      <p className="text-xs text-muted-foreground mb-3">{v.source}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => generatePreview(vid, v.name)}
                          disabled={!vid || generating}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded text-xs"
                        >
                          <Play size={12} /> Play
                        </button>
                        <button
                          onClick={() => setAssignVoice(v)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-card border border-border rounded text-xs"
                        >
                          <UserPlus size={12} /> Assign
                        </button>
                        <button
                          onClick={() => setAsOracleMaster(vid, v.name, (cfg.settings as VoiceSettings) || undefined)}
                          disabled={!vid}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-xs font-medium hover:bg-amber-500/20"
                          title="Set as Oracle's master voice"
                        >
                          <Crown size={12} /> Master
                        </button>
                        <button
                          onClick={() => deleteVoice.mutate(v.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-destructive/10 text-destructive rounded text-xs ml-auto"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STUDIO */}
        {tab === "studio" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-bold text-lg">{studioVoiceName}</h2>
                  <p className="text-xs text-muted-foreground font-mono">{studioVoiceId}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAsOracleMaster(studioVoiceId, studioVoiceName, settings)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-sm font-medium hover:bg-amber-500/20"
                    title="Set as Oracle's master voice"
                  >
                    <Crown size={14} /> Set as Master
                  </button>
                  <button
                    onClick={handleSaveCurrent}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm"
                  >
                    <Save size={14} /> Save
                  </button>
                </div>
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="Type text to preview..."
                className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:outline-none focus:border-primary"
              />

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => generatePreview(studioVoiceId, studioVoiceName)}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
                >
                  {generating ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                  Generate
                </button>
                <button
                  onClick={stopAudio}
                  className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg"
                >
                  <Square size={16} /> Stop
                </button>
              </div>
            </div>

            {/* Presets */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Quick Presets</h3>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PRESETS) as PresetName[]).map((name) => (
                  <button
                    key={name}
                    onClick={() => applyPreset(name)}
                    className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm hover:bg-primary/20"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced */}
            <div className="bg-card border border-border rounded-lg p-4">
              <button
                onClick={() => setShowAdvanced((s) => !s)}
                className="flex items-center justify-between w-full mb-2"
              >
                <h3 className="font-semibold flex items-center gap-2">
                  <Settings2 size={16} /> Advanced Controls
                </h3>
                <span className="text-muted-foreground text-sm">{showAdvanced ? "Hide" : "Show"}</span>
              </button>

              {showAdvanced && (
                <div className="space-y-4 pt-2">
                  <Slider
                    label="Stability"
                    value={settings.stability}
                    min={0}
                    max={1}
                    step={0.05}
                    hint="Lower = more expressive. Higher = more consistent."
                    onChange={(v) => setSettings((s) => ({ ...s, stability: v }))}
                  />
                  <Slider
                    label="Similarity Boost"
                    value={settings.similarity_boost}
                    min={0}
                    max={1}
                    step={0.05}
                    hint="How closely to match the original voice."
                    onChange={(v) => setSettings((s) => ({ ...s, similarity_boost: v }))}
                  />
                  <Slider
                    label="Style Exaggeration"
                    value={settings.style}
                    min={0}
                    max={1}
                    step={0.05}
                    hint="Higher = more stylized. Multilingual v2+ only."
                    onChange={(v) => setSettings((s) => ({ ...s, style: v }))}
                  />
                  <Slider
                    label="Speed"
                    value={settings.speed}
                    min={0.7}
                    max={1.2}
                    step={0.05}
                    hint="Speech rate multiplier."
                    onChange={(v) => setSettings((s) => ({ ...s, speed: v }))}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.use_speaker_boost}
                      onChange={(e) => setSettings((s) => ({ ...s, use_speaker_boost: e.target.checked }))}
                    />
                    Speaker Boost (enhances clarity)
                  </label>

                  <div>
                    <label className="text-sm font-medium block mb-1">Model</label>
                    <select
                      value={settings.model_id}
                      onChange={(e) => setSettings((s) => ({ ...s, model_id: e.target.value }))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    >
                      {MODELS.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setSettings(DEFAULT_SETTINGS)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Reset to defaults
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assign Dialog */}
      <Dialog open={!!assignVoice} onOpenChange={(o) => !o && setAssignVoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign "{assignVoice?.name}" to an avatar</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {avatars.length === 0 ? (
              <p className="text-sm text-muted-foreground">No avatars yet.</p>
            ) : (
              avatars.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAssignToAvatar(a.id)}
                  className="w-full text-left p-3 bg-card border border-border rounded-lg hover:border-primary"
                >
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.purpose}</p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-xs text-muted-foreground font-mono">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
