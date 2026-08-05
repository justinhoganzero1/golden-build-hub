// <SignedImage> / <SignedVideo>: drop-in replacements for <img>/<video> that
// auto-resolve private Supabase Storage URLs to short-lived signed URLs.
// If the network request 400s/403s, we transparently re-sign and retry once.
import { useEffect, useRef, useState, type ImgHTMLAttributes, type VideoHTMLAttributes } from "react";
import { resolveStorageUrl, parseStorageUrl, isPrivateStorageBucket } from "@/lib/signedStorageUrl";
import { supabase } from "@/integrations/supabase/client";
import useResilientVideo from "@/hooks/useResilientVideo";
import { ExternalLink, RotateCw } from "lucide-react";
import { DownloadButton } from "@/components/DownloadButton";
import { Button } from "@/components/ui/button";

function useSignedSrc(src: string | undefined, ttl = 3600) {
  const [resolved, setResolved] = useState<string>("");
  const objectUrlRef = useRef<string>();

  useEffect(() => {
    let alive = true;
    if (!src) { setResolved(""); return; }
    resolveStorageUrl(src, ttl).then((u) => { if (alive) setResolved(u); });
    return () => {
      alive = false;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = undefined;
    };
  }, [src, ttl]);

  const retry = async () => {
    const parsed = parseStorageUrl(src);
    if (!parsed || !isPrivateStorageBucket(parsed.bucket)) return false;
    // Some browsers/providers reject a signed object URL while an authenticated
    // storage download remains valid. Downloading to a local blob is a reliable
    // final fallback and prevents the broken JPEG icon shown in Story Writer.
    const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.path);
    if (error || !data) return false;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(data);
    setResolved(objectUrlRef.current);
    return true;
  };

  return { resolved, retry };
}

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string; ttlSeconds?: number };

export function SignedImage({ src, ttlSeconds, onError, ...rest }: ImgProps) {
  const { resolved, retry } = useSignedSrc(src, ttlSeconds);
  const retriedRef = useRef(false);
  useEffect(() => { retriedRef.current = false; }, [src]);
  if (!resolved) return null;
  return (
    <img
      {...rest}
      src={resolved}
      onError={async (e) => {
        if (!retriedRef.current) {
          retriedRef.current = true;
          if (await retry()) return;
        }
        onError?.(e);
      }}
    />
  );
}

type VideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src"> & {
  src?: string;
  ttlSeconds?: number;
  type?: string;
};

export function SignedVideo({ src, ttlSeconds, type = "video/mp4", onError, children, ...rest }: VideoProps) {
  const { resolved, retry } = useSignedSrc(src, ttlSeconds);
  const { ref, exhausted, retry: retryPlayback, totalFallbacks } = useResilientVideo({ onResign: retry });
  if (!resolved) return null;
  return (
    <div className="relative w-full h-full">
      <video
        ref={ref}
        playsInline
        preload="auto"
        {...rest}
        key={resolved}
        onError={(e) => {
          retry();
          onError?.(e);
        }}
      >
        <source src={resolved} type={type} />
        {children}
      </video>

      {exhausted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 backdrop-blur-sm p-3 text-center">
          <p className="text-xs text-muted-foreground max-w-[16rem]">
            Streaming didn't hold after {totalFallbacks} retries. Save the file or open it directly instead.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <DownloadButton url={resolved} filename="oracle-lunar-video.mp4" label="Download MP4" size="sm" />
            <Button asChild size="sm" variant="outline">
              <a href={resolved} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open in new tab
              </a>
            </Button>
            <Button size="sm" variant="ghost" onClick={retryPlayback}>
              <RotateCw className="w-3.5 h-3.5 mr-1" /> Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
