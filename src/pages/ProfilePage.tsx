import { useState } from "react";
import { User, Camera, Mail, Phone, MapPin, Edit3, Save, Sparkles, Loader2, Palette } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const STYLES = [
  { value: "realistic-portrait", label: "Realistic" },
  { value: "anime", label: "Anime" },
  { value: "cartoon-3d", label: "3D Cartoon" },
  { value: "cyberpunk", label: "Cyberpunk" },
  { value: "fantasy", label: "Fantasy" },
  { value: "watercolor", label: "Watercolor" },
  { value: "minimalist", label: "Minimalist" },
  { value: "chibi", label: "Chibi" },
];

const BLOCKED_TERMS = /\b(nude|naked|nsfw|explicit|sexual|erotic|xxx|porn|hentai|topless|lingerie|underwear|bikini|seductive|provocative|undress|strip)\b/i;

const GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

const ProfilePage = () => {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: "User", email: user?.email || "user@example.com",
    phone: "+1 (555) 000-0000", location: "New York, USA",
    bio: "Exploring the world with AI by my side ✨",
  });

  // Avatar generator state
  const [showAvatarGen, setShowAvatarGen] = useState(false);
  const [avatarStyle, setAvatarStyle] = useState("realistic-portrait");
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

  const handleSave = () => { setEditing(false); toast.success("Profile updated!"); };

  const generateAvatar = async () => {
    const desc = avatarPrompt.trim() || "a friendly person";
    if (BLOCKED_TERMS.test(desc)) {
      toast.error("Content must be M-rated. Explicit descriptions are not allowed.");
      return;
    }
    setAvatarLoading(true);
    try {
      const stylePrompts: Record<string, string> = {
        "realistic-portrait": `Ultra-photorealistic portrait headshot of ${desc}. Studio lighting, shallow depth of field, 8K quality.`,
        "anime": `Anime style character of ${desc}. Vibrant colors, detailed anime eyes, clean lines.`,
        "cartoon-3d": `3D Pixar-style cartoon character of ${desc}. Smooth render, vibrant, Disney quality.`,
        "cyberpunk": `Cyberpunk character of ${desc}. Neon lighting, futuristic, blade runner aesthetic.`,
        "fantasy": `Epic fantasy character of ${desc}. Magical atmosphere, dramatic lighting.`,
        "watercolor": `Watercolor portrait of ${desc}. Soft washes, artistic brushstrokes.`,
        "minimalist": `Minimalist flat design avatar of ${desc}. Clean geometric shapes, modern.`,
        "chibi": `Cute chibi character of ${desc}. Big head, small body, kawaii style.`,
      };
      const fullPrompt = stylePrompts[avatarStyle] || `Avatar portrait of ${desc}`;

      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: fullPrompt }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Generation failed");
        return;
      }
      const data = await resp.json();
      if (data.imageUrl) {
        setProfileAvatar(data.imageUrl);
        toast.success("Avatar generated! 🎨");
        setShowAvatarGen(false);
      }
    } catch {
      toast.error("Failed to generate avatar");
    } finally {
      setAvatarLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-3">
            {profileAvatar ? (
              <img src={profileAvatar} alt="Profile avatar" className="w-24 h-24 rounded-full object-cover border-2 border-primary" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                <User className="w-10 h-10 text-primary" />
              </div>
            )}
            <button
              onClick={() => setShowAvatarGen(!showAvatarGen)}
              className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
          </div>
          <h2 className="text-lg font-bold text-foreground">{profile.name}</h2>
          <p className="text-xs text-muted-foreground">{profile.bio}</p>
        </div>

        {/* Avatar Generator */}
        {showAvatarGen && (
          <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Generate Profile Avatar</h3>
            </div>
            <p className="text-xs text-muted-foreground">Describe your ideal avatar — M-rated only.</p>

            {/* Style pills */}
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setAvatarStyle(s.value)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                    avatarStyle === s.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <textarea
              value={avatarPrompt}
              onChange={e => setAvatarPrompt(e.target.value)}
              placeholder="e.g. A smiling young woman with curly red hair and green eyes..."
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none resize-none h-20"
              maxLength={300}
            />

            <button
              onClick={generateAvatar}
              disabled={avatarLoading}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {avatarLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Avatar</>}
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[{ label: "Days Active", value: "42" }, { label: "Features Used", value: "18" }, { label: "AI Chats", value: "156" }].map(s => (
            <div key={s.label} className="text-center p-3 bg-card border border-border rounded-xl"><p className="text-lg font-bold text-primary">{s.value}</p><p className="text-[10px] text-muted-foreground">{s.label}</p></div>
          ))}
        </div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Personal Info</h2>
          <button onClick={() => editing ? handleSave() : setEditing(true)} className="flex items-center gap-1 text-xs text-primary">
            {editing ? <><Save className="w-3.5 h-3.5" /> Save</> : <><Edit3 className="w-3.5 h-3.5" /> Edit</>}
          </button>
        </div>
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {([{ icon: <User className="w-4 h-4" />, label: "Name", key: "name" as const }, { icon: <Mail className="w-4 h-4" />, label: "Email", key: "email" as const }, { icon: <Phone className="w-4 h-4" />, label: "Phone", key: "phone" as const }, { icon: <MapPin className="w-4 h-4" />, label: "Location", key: "location" as const }]).map(field => (
            <div key={field.key} className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-primary">{field.icon}</span>
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground">{field.label}</p>
                {editing ? <input value={profile[field.key]} onChange={e => setProfile(p => ({ ...p, [field.key]: e.target.value }))} className="text-sm text-foreground bg-transparent outline-none border-b border-primary w-full" /> : <p className="text-sm text-foreground">{profile[field.key]}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
