import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import LibraryAppViewer from "@/components/library/LibraryAppViewer";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import type { OracleArtifact } from "@/lib/oraclePresenter";

export default function OracleArtifactViewer({ artifact, onClose }: { artifact: OracleArtifact | null; onClose: () => void }) {
  const navigate = useNavigate();
  return <Dialog open={!!artifact} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto rounded-lg">
      <DialogTitle>Your {artifact?.kind}</DialogTitle>
      <DialogDescription>{artifact?.libraryId ? "Saved in your Library" : "Library save not confirmed"}</DialogDescription>
      {artifact?.kind === "image" && <img src={artifact.url} alt="Your finished creation" className="w-full max-h-[65dvh] object-contain" />}
      {artifact?.kind === "video" && <video src={artifact.url} controls playsInline autoPlay className="w-full max-h-[65dvh]" />}
      {artifact?.kind === "audio" && <audio src={artifact.url} controls autoPlay className="w-full" />}
      {artifact?.kind === "story" && <div className="prose prose-invert max-w-none"><ReactMarkdown>{artifact.body || ""}</ReactMarkdown></div>}
      {artifact?.kind === "app" && <div className="h-[60dvh] flex flex-col"><LibraryAppViewer item={{ id: artifact.id, title: "Your app", url: artifact.url }} /></div>}
      {artifact?.libraryId && <Button variant="outline" onClick={() => { onClose(); navigate(artifact.deepPath); }}>Open in Library</Button>}
    </DialogContent>
  </Dialog>;
}