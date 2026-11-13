import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Smartphone } from "lucide-react";
import officeBackdrop from "@/assets/oracle-office-empty.jpg";
import { fileMimeType, isShareableMediaSource, type SharedKind } from "@/lib/sharedMedia";

/** Public player for things members share from their Library. No sign-in needed. */
const WatchPage = () => {
  const [params] = useSearchParams();
  const src = params.get("src") || "";
  const title = (params.get("title") || "Shared from Oracle Lunar").slice(0, 120);
  const kind = (["video", "audio", "image", "doc"].includes(params.get("type") || "") ? params.get("type") : "video") as SharedKind;
  const allowed = isShareableMediaSource(src);
  const fileName = useMemo(() => {
    const last = src.split("?")[0].split("/").pop() || "";
    return /\.[a-z0-9]{2,5}$/i.test(last) ? last : `oracle-lunar.${kind === "audio" ? "mp3" : kind === "image" ? "png" : kind === "doc" ? "txt" : "mp4"}`;
  }, [src, kind]);
  const [playSrc, setPlaySrc] = useState(allowed ? src : "");
  const [failed, setFailed] = useState(false);
  const retried = useRef(false);
  const objectUrl = useRef<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docMime, setDocMime] = useState("");
  const [docText, setDocText] = useState<string | null>(null);

  useEffect(() => { document.title = `${title} · Oracle Lunar`; }, [title]);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  // Documents, apps and notes: signed file links arrive labelled as plain
  // text, so fetch the bytes, re-label them with the real type and show
  // them here — apps run in a sandboxed frame, notes show as text.
  useEffect(() => {
    if (kind !== "doc" || !allowed) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(String(res.status));
        const mime = fileMimeType(fileName, res.headers.get("content-type"));
        const blob = new Blob([await res.arrayBuffer()], { type: mime });
        if (cancelled) return;
        setDocMime(mime);
        if (mime === "text/html" || mime === "application/pdf") {
          objectUrl.current = URL.createObjectURL(blob);
          setDocUrl(objectUrl.current);
        } else {
          setDocText(await blob.text());
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [kind, allowed, src, fileName]);

  // Some saved files are stored with a generic file type, which phones won't play.
  // Re-label the bytes with the real type and play them from memory instead.
  const onMediaError = async () => {
    if (retried.current || !allowed) { setFailed(true); return; }
    retried.current = true;
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(String(res.status));
      const blob = new Blob([await res.arrayBuffer()], { type: fileMimeType(fileName, res.headers.get("content-type")) });
      objectUrl.current = URL.createObjectURL(blob);
      setPlaySrc(objectUrl.current);
    } catch {
      setFailed(true);
    }
  };

  return (
    <main data-no-tab-glow className="oracle-signin">
      <img src={officeBackdrop} alt="" aria-hidden className="oracle-signin-bg" width={848} height={1264} />
      <div aria-hidden className="oracle-signin-scrim" />
      <div aria-hidden className="oracle-signin-sweep" />

      <header className="oracle-signin-header">
        <h1 className="font-semibold text-foreground">Oracle <span className="font-normal text-primary">Lunar</span></h1>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />Your AI best friend, always here for you
        </p>
      </header>

      <section className="oracle-signin-card" aria-labelledby="watch-title">
        <h2 id="watch-title" className="oracle-signin-title break-words">{title}</h2>
        <p className="oracle-signin-sub">Shared with you from Oracle Lunar.</p>

        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background">
          {!allowed || failed ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {allowed
                ? "This link has expired or can't be played here. Ask the person who sent it for a new link."
                : "This link isn't valid. Ask the person who sent it for a new link."}
            </p>
          ) : kind === "image" ? (
            <img src={playSrc} alt={title} className="block max-h-[60vh] w-full object-contain" onError={() => setFailed(true)} />
          ) : kind === "audio" ? (
            <audio src={playSrc} controls preload="metadata" className="w-full p-3" onError={onMediaError} />
          ) : kind === "doc" ? (
            docUrl && docMime === "text/html" ? (
              <iframe title={title} src={docUrl} sandbox="allow-scripts allow-downloads allow-modals" className="block h-[60vh] w-full border-0 bg-background" />
            ) : docUrl ? (
              <iframe title={title} src={docUrl} className="block h-[60vh] w-full border-0 bg-background" />
            ) : docText !== null ? (
              <div className="max-h-[60vh] overflow-auto p-4 text-left text-sm leading-relaxed whitespace-pre-wrap text-foreground">{docText}</div>
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">Opening…</p>
            )
          ) : (
            <video
              key={playSrc}
              src={playSrc.startsWith("blob:") ? playSrc : `${playSrc}#t=0.001`}
              controls
              playsInline
              preload="metadata"
              className="block max-h-[60vh] w-full bg-background"
              onError={onMediaError}
            />
          )}
        </div>

        {allowed && !failed && (
          <a href={src} download={fileName} target="_blank" rel="noopener noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground hover:border-primary">
            <Download className="h-4 w-4 text-primary" /> Save to my phone
          </a>
        )}
        <Link to="/download" className="oracle-signin-submit mt-3 flex items-center justify-center gap-2">
          <Smartphone className="h-4 w-4" /> Get Oracle Lunar — free
        </Link>
      </section>
    </main>
  );
};

export default WatchPage;
