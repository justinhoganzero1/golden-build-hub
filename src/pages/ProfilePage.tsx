import { useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { User, Camera, Mail, Phone, MapPin, Edit3, Save, Sparkles, Loader2, Palette, Upload, Share2, ImagePlus } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ShareDialog from "@/components/ShareDialog";

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

  // Photo upload & edit state
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showEnlarged, setShowEnlarged] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = () => { setEditing(false); toast.success("Profile updated!"); };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedPhoto(reader.result as string);
      setEditMode(true);
      toast.success("Photo uploaded! Describe how to transform it.");
    };
    reader.readAsDataURL(file);
  };

  const generateAvatar = async () => {
    const desc = avatarPrompt.trim() || "a friendly person";
    if (BLOCKED_TERMS.test(desc)) {
      toast.error("Content must be M-rated. Explicit descriptions are not allowed.");
      return;
    }
    setAvatarLoading(true);
    try {
      const body: any = { prompt: "" };

      if (editMode && uploadedPhoto) {
        // AI edit mode - transform uploaded photo
        const styleHint = avatarStyle !== "realistic-portrait" ? ` in ${avatarStyle.replace("-", " ")} style` : "";
        body.prompt = `Transform this photo: ${desc}${styleHint}. Keep the person recognizable. High quality portrait.`;
        body.inputImage = uploadedPhoto;
      } else {
        // Pure generation mode
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
        body.prompt = stylePrompts[avatarStyle] || `Avatar portrait of ${desc}`;
      }

      const resp = await fetch(GEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Generation failed");
        return;
      }
      const data = await resp.json();
      const imgUrl = data.images?.[0]?.image_url?.url || data.imageUrl;
      if (imgUrl) {
        setProfileAvatar(imgUrl);
        toast.success(editMode ? "Photo transformed! 🎨" : "Avatar generated! 🎨");
        setShowAvatarGen(false);
        setEditMode(false);
      } else {
        // AI refused or returned no image — show its explanation
        const reason = data.text || "No image was generated. Try a different description.";
        toast.error(reason.length > 120 ? reason.slice(0, 120) + "…" : reason);
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
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
      <div className="px-4 pt-14 pb-4">
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-3">
            {profileAvatar ? (
              <img src={profileAvatar} alt="Profile avatar" onClick={() => setShowEnlarged(true)} className="w-24 h-24 rounded-full object-cover border-2 border-primary cursor-pointer hover:scale-105 transition-transform" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center cursor-pointer hover:scale-105 transition-transform" onClick={() => setShowEnlarged(true)}>
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
          {profileAvatar && (
            <button onClick={() => setShowShare(true)} className="text-xs text-primary flex items-center gap-1 mb-1">
              <Share2 className="w-3 h-3" /> Share Avatar
            </button>
          )}
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

            {/* Upload / Generate Toggle */}
            <div className="flex gap-2">
              <button onClick={() => { setEditMode(false); setUploadedPhoto(null); }}
                className={`flex-1 py-2 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 ${!editMode ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                <Sparkles className="w-3 h-3" /> Generate New
              </button>
              <button onClick={() => fileRef.current?.click()}
                className={`flex-1 py-2 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 ${editMode ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                <ImagePlus className="w-3 h-3" /> Upload & Edit
              </button>
            </div>

            {/* Uploaded photo preview */}
            {editMode && uploadedPhoto && (
              <div className="relative aspect-square rounded-lg overflow-hidden border border-border">
                <img src={uploadedPhoto} alt="Uploaded" className="w-full h-full object-cover" />
                <button onClick={() => fileRef.current?.click()}
                  className="absolute bottom-1 right-1 px-2 py-1 bg-primary/80 text-primary-foreground rounded text-[9px] flex items-center gap-1">
                  <Upload className="w-2.5 h-2.5" /> Change
                </button>
              </div>
            )}

            {editMode && !uploadedPhoto && (
              <button onClick={() => fileRef.current?.click()}
                className="w-full py-6 border-2 border-dashed border-border rounded-lg flex flex-col items-center gap-1 hover:border-primary transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground">Upload your photo • Max 10MB</p>
              </button>
            )}

            <p className="text-xs text-muted-foreground">
              {editMode ? "Describe how to transform your photo — M-rated only." : "Describe your ideal avatar — M-rated only."}
            </p>

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
              placeholder={editMode
                ? "e.g. Make me look like a superhero, turn it into anime style, put me in space..."
                : "e.g. A smiling young woman with curly red hair and green eyes..."
              }
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none resize-none h-20"
              maxLength={300}
            />

            <button
              onClick={generateAvatar}
              disabled={avatarLoading || (editMode && !uploadedPhoto)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {avatarLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><Sparkles className="w-4 h-4" /> {editMode ? "Transform Photo" : "Generate Avatar"}</>}
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

      {/* Enlarged avatar dialog */}
      <Dialog open={showEnlarged} onOpenChange={setShowEnlarged}>
        <DialogContent className="max-w-sm bg-background border-primary/30 flex items-center justify-center p-6">
          {profileAvatar ? (
            <img src={profileAvatar} alt="Profile avatar enlarged" className="w-72 h-72 rounded-full object-cover border-4 border-primary animate-scale-in" />
          ) : (
            <div className="w-72 h-72 rounded-full bg-primary/10 border-4 border-primary flex items-center justify-center animate-scale-in">
              <User className="w-24 h-24 text-primary" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        title="My Avatar"
        url={profileAvatar || undefined}
        imageUrl={profileAvatar || undefined}
        description="Check out my AI avatar from Solace!"
      />
    </div>
  );
};

export default ProfilePage;
