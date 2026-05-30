import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FilePlus2, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { saveToLibrary, type LibraryMediaType } from "@/lib/saveToLibrary";

interface Props {
  sourcePage: string;
  title: string;
  mediaType?: LibraryMediaType;
  buildBody?: () => string | Promise<string>;
  className?: string;
  label?: string;
}

/**
 * Universal "Create Library File" action. Drops a verifiable proof entry into
 * the user's Media Library for the calling app/tile. Used to guarantee every
 * tile can demonstrably write to the library.
 */
export const CreateLibraryFileButton = ({
  sourcePage,
  title,
  mediaType = "document",
  buildBody,
  className,
  label = "Create Library File",
}: Props) => {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");

  const handleClick = async () => {
    setState("saving");
    try {
      const body = buildBody ? await buildBody() : `${title}\n\nGenerated from ${sourcePage} on ${new Date().toLocaleString()}.`;
      const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`;
      const id = await saveToLibrary({
        media_type: mediaType,
        title,
        url: dataUrl,
        source_page: sourcePage,
        metadata: {
          kind: "library_proof",
          created_via: "CreateLibraryFileButton",
          created_at: new Date().toISOString(),
        },
      });
      if (id) {
        setState("done");
        toast.success("Saved to your Library");
      } else {
        setState("idle");
        toast.error("Could not save — try again");
      }
    } catch (e: any) {
      setState("idle");
      toast.error(e?.message || "Could not save");
    }
  };

  return (
    <Button onClick={handleClick} disabled={state === "saving"} variant="secondary" className={className}>
      {state === "saving" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> :
       state === "done"   ? <Check className="w-4 h-4 mr-2 text-emerald-400" /> :
                            <FilePlus2 className="w-4 h-4 mr-2" />}
      {state === "done" ? "Saved to Library" : label}
    </Button>
  );
};

export default CreateLibraryFileButton;
