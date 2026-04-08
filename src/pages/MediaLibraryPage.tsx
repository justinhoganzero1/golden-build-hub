import { Camera, Image, Video, FolderOpen, Grid, List, Search } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useState } from "react";

const mediaItems = [
  { type: "image", name: "Sunset.jpg", size: "2.4 MB", date: "Today" },
  { type: "video", name: "Interview.mp4", size: "45 MB", date: "Yesterday" },
  { type: "image", name: "Portrait.png", size: "3.1 MB", date: "Mar 28" },
  { type: "image", name: "Landscape.jpg", size: "1.8 MB", date: "Mar 27" },
  { type: "video", name: "Tutorial.mp4", size: "120 MB", date: "Mar 25" },
  { type: "image", name: "Product.jpg", size: "4.2 MB", date: "Mar 24" },
];

const MediaLibraryPage = () => {
  const [view, setView] = useState<"grid" | "list">("grid");
  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Camera className="w-7 h-7 text-primary" /></div>
          <div className="flex-1"><h1 className="text-xl font-bold text-primary">Media Library</h1><p className="text-muted-foreground text-xs">Your media collection</p></div>
          <button onClick={() => setView(view === "grid" ? "list" : "grid")} className="p-2 rounded-lg bg-card border border-border">
            {view === "grid" ? <List className="w-4 h-4 text-primary" /> : <Grid className="w-4 h-4 text-primary" />}
          </button>
        </div>
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input placeholder="Search media..." className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none" />
        </div>
        <div className="flex gap-2 mb-4">
          {["All", "Images", "Videos", "Audio"].map(f => (
            <button key={f} className="px-3 py-1.5 rounded-full text-xs bg-card border border-border text-muted-foreground hover:border-primary">{f}</button>
          ))}
        </div>
        {view === "grid" ? (
          <div className="grid grid-cols-3 gap-2">
            {mediaItems.map((m, i) => (
              <div key={i} className="aspect-square bg-card border border-border rounded-xl flex flex-col items-center justify-center gap-1 hover:border-primary transition-colors">
                {m.type === "image" ? <Image className="w-6 h-6 text-primary" /> : <Video className="w-6 h-6 text-primary" />}
                <p className="text-[9px] text-muted-foreground truncate w-full text-center px-1">{m.name}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {mediaItems.map((m, i) => (
              <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                <div className="p-2 rounded-lg bg-primary/10">{m.type === "image" ? <Image className="w-4 h-4 text-primary" /> : <Video className="w-4 h-4 text-primary" />}</div>
                <div className="flex-1"><p className="text-sm text-foreground">{m.name}</p><p className="text-[10px] text-muted-foreground">{m.size} • {m.date}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaLibraryPage;
