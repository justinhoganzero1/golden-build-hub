import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Image, Film, Music, X, FolderOpen, Upload } from "lucide-react";
import { useUserMedia, useSaveMedia } from "@/hooks/useUserAvatars";
import { toast } from "sonner";

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string, title?: string) => void;
  filterType?: "image" | "video" | "audio" | null;
  title?: string;
}

const MediaPickerDialog = ({ open, onOpenChange, onSelect, filterType = null, title = "Select from Library" }: MediaPickerDialogProps) => {
  const { data: media = [], isLoading } = useUserMedia();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(filterType);

  const filtered = media.filter((m: any) => {
    if (typeFilter && m.media_type !== typeFilter) return false;
    if (search && !(m.title || "").toLowerCase().includes(search.toLowerCase()) && !(m.source_page || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getIcon = (type: string) => {
    if (type === "video") return <Film className="w-4 h-4" />;
    if (type === "audio") return <Music className="w-4 h-4" />;
    return <Image className="w-4 h-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search media..."
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
          {search && <button onClick={() => setSearch("")}><X className="w-3 h-3 text-muted-foreground" /></button>}
        </div>

        {!filterType && (
          <div className="flex gap-2">
            {[null, "image", "video", "audio"].map(t => (
              <button key={t || "all"} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {t ? t.charAt(0).toUpperCase() + t.slice(1) + "s" : "All"}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
              <Image className="w-8 h-8 mb-2 opacity-50" />
              <p>No media found</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-1">
              {filtered.map((item: any) => (
                <button key={item.id} onClick={() => { onSelect(item.url, item.title); onOpenChange(false); }}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-border hover:border-primary transition-colors bg-card">
                  {item.media_type === "image" ? (
                    <img src={item.url} alt={item.title || "Media"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                      {getIcon(item.media_type)}
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center">{item.title || item.media_type}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaPickerDialog;
