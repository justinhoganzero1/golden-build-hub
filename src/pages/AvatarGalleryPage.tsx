import { useState } from "react";
import { Palette, Plus, Trash2, Star, Eye, Crown } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useNavigate } from "react-router-dom";
import { useUserAvatars, useDeleteAvatar, type UserAvatar } from "@/hooks/useUserAvatars";
import { useSetMasterAvatar } from "@/hooks/useMasterAvatar";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LivingAvatar from "@/components/LivingAvatar";

const PURPOSE_LABELS: Record<string, { label: string; icon: string }> = {
  oracle: { label: "Oracle", icon: "🔮" },
  profile: { label: "Profile", icon: "👤" },
  "ai-friend": { label: "AI Friend", icon: "🤖" },
  partner: { label: "Partner", icon: "💕" },
};

const AvatarGalleryPage = () => {
  const navigate = useNavigate();
  const { data: avatars = [], isLoading } = useUserAvatars();
  const deleteAvatar = useDeleteAvatar();
  const setMaster = useSetMasterAvatar();
  const [selected, setSelected] = useState<UserAvatar | null>(null);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? avatars : avatars.filter(a => a.purpose === filter);

  const handleDelete = (id: string) => {
    deleteAvatar.mutate(id, {
      onSuccess: () => { toast.success("Avatar deleted"); setSelected(null); },
    });
  };

  const handleSetMaster = (avatar: UserAvatar) => {
    if (avatar.is_default && avatar.purpose === "oracle") {
      toast.info(`"${avatar.name}" is already your Master Oracle`);
      return;
    }
    setMaster.mutate(avatar.id, {
      onSuccess: () => {
        toast.success(`👑 "${avatar.name}" is now your Master Oracle avatar`);
        setSelected(null);
      },
      onError: (e: any) => {
        console.error("Set master avatar error:", e);
        toast.error(e?.message || "Could not set master avatar");
      },
    });
  };

  return (
    <div className="min-h-screen pb-20" style={{ background: "#0f0f0f" }}>
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10"><Palette className="w-7 h-7 text-purple-400" /></div>
            <div>
              <h1 className="text-xl font-bold text-white">Avatar Gallery</h1>
              <p className="text-gray-500 text-xs">{avatars.length} avatars created</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/avatar-generator")}
            className="p-2.5 rounded-xl bg-purple-600 text-white"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { value: "all", label: "All" },
            { value: "oracle", label: "🔮 Oracle" },
            { value: "profile", label: "👤 Profile" },
            { value: "ai-friend", label: "🤖 Friends" },
            { value: "partner", label: "💕 Partners" },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                filter === f.value
                  ? "bg-purple-600 text-white"
                  : "bg-[#1a1a1a] border border-gray-800 text-gray-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Palette className="w-16 h-16 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No avatars yet</p>
            <button
              onClick={() => navigate("/avatar-generator")}
              className="mt-3 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm"
            >
              Create Your First Avatar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map(avatar => (
              <button
                key={avatar.id}
                onClick={() => setSelected(avatar)}
                className="bg-[#1a1a1a] border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500 transition-all group"
              >
                <div className="aspect-square bg-[#0f0f0f] flex items-center justify-center overflow-hidden">
                  {avatar.image_url ? (
                    <img src={avatar.image_url} alt={avatar.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">{PURPOSE_LABELS[avatar.purpose]?.icon || "🎭"}</span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-medium text-white truncate">{avatar.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px]">{PURPOSE_LABELS[avatar.purpose]?.icon}</span>
                    <span className="text-[10px] text-gray-500">{PURPOSE_LABELS[avatar.purpose]?.label}</span>
                    {avatar.is_default && <Star className="w-2.5 h-2.5 text-amber-400 ml-auto" />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-[#1a1a1a] border-gray-800 max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="aspect-square rounded-xl bg-[#0f0f0f] overflow-hidden">
                {selected.image_url ? (
                  <LivingAvatar
                    imageUrl={selected.image_url}
                    alt={selected.name}
                    intensity="normal"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl">
                    {PURPOSE_LABELS[selected.purpose]?.icon}
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span className="text-gray-500">Purpose</span>
                  <span>{PURPOSE_LABELS[selected.purpose]?.icon} {PURPOSE_LABELS[selected.purpose]?.label}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span className="text-gray-500">Voice</span>
                  <span>{selected.voice_style}</span>
                </div>
                {(selected.purpose === "partner" || selected.purpose === "ai-friend") && (
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-500">Personality</span>
                    <span>{selected.personality}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-300">
                  <span className="text-gray-500">Created</span>
                  <span>{new Date(selected.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => handleSetMaster(selected)}
                disabled={setMaster.isPending}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Crown className="w-4 h-4" />
                {setMaster.isPending
                  ? "Setting…"
                  : selected.is_default && selected.purpose === "oracle"
                    ? "✓ Master Oracle (tap to re-confirm)"
                    : "Set as Master Oracle"}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigate("/oracle"); setSelected(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-4 h-4" /> Use in Chat
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="py-2.5 px-4 rounded-xl bg-red-600/10 text-red-400 text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvatarGalleryPage;
