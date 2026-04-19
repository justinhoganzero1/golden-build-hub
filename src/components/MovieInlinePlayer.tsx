// Inline MP4 player with download button. Used in MovieProjectDashboard
// so finished movies play right inside the card.
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";

interface Props {
  url: string;
  title: string;
}

export function MovieInlinePlayer({ url, title }: Props) {
  const downloadName = `${title.replace(/[^a-z0-9]/gi, "_")}.mp4`;

  return (
    <div className="mt-2 space-y-2">
      <video
        key={url}
        className="aspect-video w-full rounded-md bg-black"
        controls
        playsInline
        preload="metadata"
      >
        <source src={url} type="video/mp4" />
        Your browser does not support video playback.
      </video>
      <div className="grid grid-cols-2 gap-1.5">
        <Button asChild size="sm" variant="outline" className="h-8 text-[10px]">
          <a href={url} download={downloadName}>
            <Download className="mr-1 h-3 w-3" /> Download MP4
          </a>
        </Button>
        <Button asChild size="sm" variant="outline" className="h-8 text-[10px]">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-3 w-3" /> Open
          </a>
        </Button>
      </div>
    </div>
  );
}

export default MovieInlinePlayer;
