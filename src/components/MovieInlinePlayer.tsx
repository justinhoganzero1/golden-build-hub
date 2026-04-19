// Inline MP4 player with download button. Used in MovieProjectDashboard
// so finished movies play right inside the card.
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";

interface Props { url: string; title: string; }

export const MovieInlinePlayer = ({ url, title }: Props) => (
  <div className="space-y-2 mt-2">
    <video
      src={url}
      controls
      preload="metadata"
      className="w-full rounded-md bg-black aspect-video"
    >
      Your browser does not support video playback.
    </video>
    <div className="grid grid-cols-2 gap-1.5">
      <Button asChild size="sm" variant="outline" className="h-8 text-[10px]">
        <a href={url} download={`${title.replace(/[^a-z0-9]/gi, "_")}.mp4`}>
          <Download className="w-3 h-3 mr-1" /> Download MP4
        </a>
      </Button>
      <Button asChild size="sm" variant="outline" className="h-8 text-[10px]">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="w-3 h-3 mr-1" /> Open
        </a>
      </Button>
    </div>
  </div>
);

export default MovieInlinePlayer;
