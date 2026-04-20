// Inline MP4 player with bullet-proof download + open buttons.
// Used in MovieProjectDashboard so finished movies play right inside the card.
import { DownloadButton, OpenButton } from "@/components/DownloadButton";

interface Props {
  url: string;
  title: string;
}

export function MovieInlinePlayer({ url, title }: Props) {
  const downloadName = `${title.replace(/[^a-z0-9]/gi, "_") || "movie"}.mp4`;

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
        <DownloadButton
          url={url}
          filename={downloadName}
          label="Download MP4"
          size="sm"
          variant="outline"
          className="h-8 text-[10px]"
        />
        <OpenButton url={url} size="sm" variant="outline" className="h-8 text-[10px]" />
      </div>
    </div>
  );
}

export default MovieInlinePlayer;
