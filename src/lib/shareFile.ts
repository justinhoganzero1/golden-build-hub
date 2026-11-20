// Shares a file the member just made (e.g. a filmed episode) by attaching the real file
// to the device's share menu. If this device can't attach it, the file is saved to the
// device instead so it can be picked from the gallery in any app.
import { toast } from "sonner";
import { systemShare } from "./systemShare";

export function saveBlobToDevice(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function shareMadeFile(blob: Blob, fileName: string, title: string): Promise<void> {
  const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
  const outcome = await systemShare({ title, text: title, file });
  if (outcome === "shared" || outcome === "cancelled") return;
  saveBlobToDevice(blob, fileName);
  toast.info("This device can't attach the video to a share, so it's saved to your device. Open any app and pick it from your files or gallery.");
}
