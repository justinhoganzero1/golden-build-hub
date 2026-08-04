import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Image, Film, Music, X, FolderOpen, Upload, Loader2 } from "lucide-react";
import { useUserMedia, useSaveMedia } from "@/hooks/useUserAvatars";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getThumbnailUrl } from "@/lib/thumbnail";


interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string, title?: string) => void;
  filterType?: "image" | "video" | "audio" | null;
  title?: string;
}

/**
 * A single library tile.
 *
 * Tiles only fetch anything once they scroll into view, and what they show is a
 * *very* low-res thumbnail (storage-side resize where possible, canvas
 * downscale otherwise) so a grid of 4K artwork still loads instantly. The
 * full-size original is only fetched at the moment the user actually picks it.
 */
const MediaTile = ({
  item,
  icon,
  onPick,
}: {
  item: any;
  icon: React.ReactNode;
  onPick: (url: string, title?: string) => void;
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [picking, setPicking] = useState(false);
  const isImage = item.media_type === "image" || item.media_type === "gif";

  // Only start work when the tile is near the viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    }, { root: null, rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !isImage || preview) return;
    let alive = true;
    (async () => {
      let source: string | null = item.thumbnail_url || null;
      if (!source) {
        const { data } = await supabase
          .from("user_media")
          .select("url")
          .eq("id", item.id)
          .maybeSingle();
        source = (data?.url as string) || null;
      }
      if (!alive || !source) return;
      const thumb = await getThumbnailUrl(source, 160);
      if (alive) setPreview(thumb || source);
    })();
    return () => { alive = false; };
  }, [visible, item.id, item.thumbnail_url, isImage, preview]);

  const handlePick = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const { data, error } = await supabase
        .from("user_media")
        .select("url")
        .eq("id", item.id)
        .maybeSingle();
      if (error) throw error;
      const url = (data?.url as string) || null;
      if (!url) throw new Error("This item has no file attached");
      onPick(url, item.title);
    } catch (e: any) {
      toast.error(e?.message || "Could not load that item");
    } finally {
      setPicking(false);
    }
  };

  return (
    <button
      ref={ref}
      onClick={handlePick}
      className="group relative aspect-square rounded-xl overflow-hidden border border-border hover:border-primary transition-colors bg-card"
    >
      {preview && isImage ? (
        <img
          src={preview}
          alt={item.title || "Media"}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
          {isImage && visible
            ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60" />
            : icon}
          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{item.title || item.media_type}</span>
        </div>
      )}
      {preview && isImage && (
        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate text-left">
          {item.title || "Untitled"}
        </span>
      )}
      {picking && (
        <span className="absolute inset-0 flex items-center justify-center bg-background/70">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </span>
      )}
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-colors" />
    </button>
  );
};




const MediaPickerDialog = ({ open, onOpenChange, onSelect, filterType = null, title = "Select from Library" }: MediaPickerDialogProps) => {
  const { data: media = [], isLoading } = useUserMedia();
  const saveMedia = useSaveMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(filterType);
  const [uploading, setUploading] = useState(false);

  const acceptAttr = filterType === "image" ? "image/*"
    : filterType === "video" ? "video/*"
    : filterType === "audio" ? "audio/*"
    : "image/*,video/*,audio/*";

  const handleBrowse = () => fileInputRef.current?.click();

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File too large (max 25MB)");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const mediaType = file.type.startsWith("video") ? "video"
        : file.type.startsWith("audio") ? "audio" : "image";
      // Persist to library so it's reusable everywhere
      try {
        await saveMedia.mutateAsync({
          media_type: mediaType,
          title: file.name,
          url: dataUrl,
          source_page: "device-upload",
        });
      } catch { /* non-fatal — still let user use the file */ }
      onSelect(dataUrl, file.name);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not read file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptAttr}
          onChange={handleFileChosen}
          className="hidden"
        />
        <button
          onClick={handleBrowse}
          disabled={uploading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {uploading ? <Upload className="w-4 h-4 animate-pulse" /> : <FolderOpen className="w-4 h-4" />}
          {uploading ? "Uploading..." : "Browse from device"}
        </button>

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
              {filtered.slice(0, 120).map((item: any) => (
                <MediaTile
                  key={item.id}
                  item={item}
                  icon={getIcon(item.media_type)}
                  onPick={(url, pickedTitle) => { onSelect(url, pickedTitle); onOpenChange(false); }}
                />
              ))}
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaPickerDialog;
