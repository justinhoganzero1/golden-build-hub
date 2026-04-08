import { useState } from "react";
import { User, Camera, Mail, Phone, MapPin, Edit3, Save } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ProfilePage = () => {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: "User", email: user?.email || "user@example.com",
    phone: "+1 (555) 000-0000", location: "New York, USA",
    bio: "Exploring the world with AI by my side ✨",
  });

  const handleSave = () => { setEditing(false); toast.success("Profile updated!"); };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center"><User className="w-10 h-10 text-primary" /></div>
            <button className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground"><Camera className="w-3.5 h-3.5" /></button>
          </div>
          <h2 className="text-lg font-bold text-foreground">{profile.name}</h2>
          <p className="text-xs text-muted-foreground">{profile.bio}</p>
        </div>
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
