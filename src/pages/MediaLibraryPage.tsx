import { Camera, Image, Video, Music, Grid, List, Search, Play, Download, Trash2, Eye, Share2 } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useUserMedia } from "@/hooks/useUserAvatars";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import ShareDialog from "@/components/ShareDialog";

const MediaLibraryPage = () => {
  const { data: mediaItems = [], isLoading } = useUserMedia();
  const qc = useQueryClient();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [shareItem, setShareItem] = useState<any>(null);

  const filtered = mediaItems.filter((m: any) => {
    if (filter === "Images" && m.media_type !== "image") return false;
    if (filter === "Videos" && m.media_type !== "video") return false;
    if (filter === "Audio" && m.media_type !== "audio") return false;
    if (search && !(m.title || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getIcon = (type: string) => {
    if (type === "image") return <Image className="w-6 h-6 text-primary" />;
    if (type === "video") return <Video className="w-6 h-6 text-primary" />;
    return <Music className="w-6 h-6 text-primary" />;
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("user_media").delete().eq("id", id);
    if (!error) {
      toast.success("Deleted");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["user-media"] });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Camera className="w-7 h-7 text-primary" /></div>
          <div className="flex-1"><h1 className="text-xl font-bold text-primary">Media Library</h1><p className="text-muted-foreground text-xs">{filtered.length} items</p></div>
          <button onClick={() => setView(view === "grid" ? "list" : "grid")} className="p-2 rounded-lg bg-card border border-border">
            {view === "grid" ? <List className="w-4 h-4 text-primary" /> : <Grid className="w-4 h-4 text-primary" />}
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search media..."
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none" />
        </div>

        <div className="flex gap-2 mb-4">
          {["All", "Images", "Videos", "Audio"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:border-primary"}`}>{f}</button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No media yet</p>
            <p className="text-muted-foreground text-xs mt-1">Generate avatars or use AI tools to create media</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((m: any) => (
              <button key={m.id} onClick={() => setSelected(m)}
                className="aspect-square bg-card border border-border rounded-xl overflow-hidden flex flex-col items-center justify-center gap-1 hover:border-primary transition-all">
                {m.media_type === "image" && m.url ? (
                  <img src={m.url} alt={m.title} className="w-full h-full object-cover" />
                ) : (
                  <>
                    {getIcon(m.media_type)}
                    <p className="text-[9px] text-muted-foreground truncate w-full text-center px-1">{m.title}</p>
                  </>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m: any) => (
              <button key={m.id} onClick={() => setSelected(m)}
                className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary transition-all text-left">
                {m.media_type === "image" && m.url ? (
                  <img src={m.url} alt={m.title} className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="p-2 rounded-lg bg-primary/10">{getIcon(m.media_type)}</div>
                )}
                <div className="flex-1">
                  <p className="text-sm text-foreground">{m.title || "Untitled"}</p>
                  <p className="text-[10px] text-muted-foreground">{m.source_page} • {new Date(m.created_at).toLocaleDateString()}</p>
                </div>
                <Eye className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-[95vw]">
          <DialogHeader><DialogTitle className="text-base">{selected?.title || "Media"}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="aspect-video bg-secondary rounded-xl flex items-center justify-center overflow-hidden">
                {selected.media_type === "image" && selected.url ? (
                  <img src={selected.url} alt={selected.title} className="w-full h-full object-contain" />
                ) : selected.media_type === "video" ? (
                  <div className="text-center"><Play className="w-12 h-12 text-primary mx-auto mb-2" /><p className="text-xs text-muted-foreground">Tap to play</p></div>
                ) : (
                  <div className="text-center"><Music className="w-12 h-12 text-primary mx-auto mb-2" /><p className="text-xs text-muted-foreground">Audio file</p></div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Source: {selected.source_page}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(selected.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { if (selected.url) { const a = document.createElement("a"); a.href = selected.url; a.download = selected.title || "media"; a.click(); } toast.success("Downloaded!"); }}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> Download
                </button>
                <button onClick={() => { setShareItem(selected); }}
                  className="py-2.5 px-4 rounded-xl bg-accent text-accent-foreground text-xs font-medium">
                  <Share2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(selected.id)}
                  className="py-2.5 px-4 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={!!shareItem}
        onOpenChange={() => setShareItem(null)}
        title={shareItem?.title || "Media"}
        url={shareItem?.url}
        imageUrl={shareItem?.url}
        description={`Check out this ${shareItem?.media_type || "media"} from Solace!`}
      />
    </div>
  );
};

export default MediaLibraryPage;
