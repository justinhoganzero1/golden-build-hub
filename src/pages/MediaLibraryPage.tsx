import { Camera, Image, Video, Music, FolderOpen, Grid, List, Search, Play, Download, Trash2, X, Eye } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface MediaItem {
  type: "image" | "video" | "audio";
  name: string;
  size: string;
  date: string;
  url?: string;
  description?: string;
}

const mediaItems: MediaItem[] = [
  { type: "image", name: "Sunset.jpg", size: "2.4 MB", date: "Today", description: "A beautiful sunset captured by AI Studio" },
  { type: "video", name: "Interview.mp4", size: "45 MB", date: "Yesterday", description: "AI-generated interview scene" },
  { type: "image", name: "Portrait.png", size: "3.1 MB", date: "Mar 28", description: "Avatar portrait generated in AI Studio" },
  { type: "image", name: "Landscape.jpg", size: "1.8 MB", date: "Mar 27", description: "Panoramic landscape from Video Studio" },
  { type: "video", name: "Tutorial.mp4", size: "120 MB", date: "Mar 25", description: "AI Tutor recorded lesson" },
  { type: "audio", name: "Podcast.mp3", size: "8.5 MB", date: "Mar 24", description: "Voice Studio audio recording" },
  { type: "image", name: "Product.jpg", size: "4.2 MB", date: "Mar 24", description: "Marketing Hub product shot" },
  { type: "video", name: "Short Film.mp4", size: "250 MB", date: "Mar 22", description: "Movie Maker generated short film" },
  { type: "audio", name: "Voice Note.wav", size: "1.2 MB", date: "Mar 20", description: "Oracle voice message" },
];

const MediaLibraryPage = () => {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const filtered = mediaItems.filter(m => {
    if (filter === "Images" && m.type !== "image") return false;
    if (filter === "Videos" && m.type !== "video") return false;
    if (filter === "Audio" && m.type !== "audio") return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getIcon = (type: string) => {
    if (type === "image") return <Image className="w-6 h-6 text-primary" />;
    if (type === "video") return <Video className="w-6 h-6 text-primary" />;
    return <Music className="w-6 h-6 text-primary" />;
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search media..." className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none" />
        </div>

        <div className="flex gap-2 mb-4">
          {["All", "Images", "Videos", "Audio"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:border-primary"}`}>{f}</button>
          ))}
        </div>

        {view === "grid" ? (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((m, i) => (
              <button key={i} onClick={() => setSelected(m)}
                className="aspect-square bg-card border border-border rounded-xl flex flex-col items-center justify-center gap-1 hover:border-primary hover:shadow-md transition-all active:scale-95">
                {getIcon(m.type)}
                <p className="text-[9px] text-muted-foreground truncate w-full text-center px-1">{m.name}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m, i) => (
              <button key={i} onClick={() => setSelected(m)}
                className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary transition-all text-left">
                <div className="p-2 rounded-lg bg-primary/10">{getIcon(m.type)}</div>
                <div className="flex-1"><p className="text-sm text-foreground">{m.name}</p><p className="text-[10px] text-muted-foreground">{m.size} • {m.date}</p></div>
                <Eye className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Media preview dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-[95vw]">
          <DialogHeader><DialogTitle className="text-base">{selected?.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="aspect-video bg-secondary rounded-xl flex items-center justify-center">
                {selected.type === "video" ? (
                  <div className="text-center">
                    <Play className="w-12 h-12 text-primary mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Tap to play</p>
                  </div>
                ) : selected.type === "audio" ? (
                  <div className="text-center">
                    <Music className="w-12 h-12 text-primary mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Audio file</p>
                  </div>
                ) : (
                  <Image className="w-16 h-16 text-primary" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{selected.description}</p>
                <p className="text-[10px] text-muted-foreground">{selected.size} • {selected.date}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toast.success("Downloaded!")} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> Download
                </button>
                <button onClick={() => { setSelected(null); toast.success("Deleted"); }} className="py-2.5 px-4 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
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

export default MediaLibraryPage;
