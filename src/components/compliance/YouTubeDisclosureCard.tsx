import { useState } from "react";
import { ShieldCheck, Copy, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { youtubeDisclosure } from "@/lib/aiDisclosure";
import { provenanceBlock, scrubIdentifiers, safeFileName } from "@/lib/metadataHygiene";

interface Props {
  title?: string;
  author?: string;
  aiVoiceUsed?: boolean;
  aiImagesUsed?: boolean;
  humanEditedPercent?: number;
}

/**
 * Disclosure automation for video exports: builds the exact YouTube
 * "altered or synthetic content" declaration plus a privacy-scrubbed
 * provenance block the creator can attach to the upload.
 */
const YouTubeDisclosureCard = ({
  title = "Untitled",
  author = "Creator",
  aiVoiceUsed = true,
  aiImagesUsed = true,
  humanEditedPercent,
}: Props) => {
  const [open, setOpen] = useState(false);

  const facts = {
    title: scrubIdentifiers(title),
    author: scrubIdentifiers(author),
    aiTextUsed: true,
    aiImagesUsed,
    aiVoiceUsed,
    humanEditedPercent,
    tools: ["Oracle Lunar", "Google Gemini", "ElevenLabs"],
  };

  const text = [
    youtubeDisclosure(facts),
    "",
    provenanceBlock({
      title: facts.title,
      author: facts.author,
      tool: "Oracle Lunar Movie Studio Pro",
      aiAssisted: true,
      humanEditedPercent,
    }),
  ].join("\n");

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    toast.success("Disclosure copied — paste it into YouTube Studio.");
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileName(title, "video")}-youtube-disclosure.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-4 bg-card border-primary/20 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> AI disclosure for this export
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setOpen(o => !o)}>
          {open ? "Hide" : "Preview"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Auto-fills YouTube's "altered or synthetic content" declaration. Exports are privacy-scrubbed
        (GPS, device and account identifiers removed) while provenance stays attached.
      </p>
      {open && (
        <pre className="text-[10px] whitespace-pre-wrap bg-muted/40 rounded-lg p-3 max-h-56 overflow-auto text-muted-foreground">
          {text}
        </pre>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
        </Button>
        <Button size="sm" variant="outline" onClick={download}>
          <Download className="w-3.5 h-3.5 mr-1.5" /> Download .txt
        </Button>
      </div>
    </Card>
  );
};

export default YouTubeDisclosureCard;
