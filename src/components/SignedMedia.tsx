// <SignedImage> / <SignedVideo>: drop-in replacements for <img>/<video> that
// auto-resolve private Supabase Storage URLs to short-lived signed URLs.
// If the network request 400s/403s, we transparently re-sign and retry once.
import { useEffect, useRef, useState, type ImgHTMLAttributes, type VideoHTMLAttributes } from "react";
import { resolveStorageUrl, parseStorageUrl, isPrivateStorageBucket } from "@/lib/signedStorageUrl";

function useSignedSrc(src: string | undefined, ttl = 3600) {
  const [resolved, setResolved] = useState<string>("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!src) { setResolved(""); return; }
    resolveStorageUrl(src, ttl).then((u) => { if (alive) setResolved(u); });
    return () => { alive = false; };
  }, [src, ttl, retryKey]);

  const retry = () => {
    const parsed = parseStorageUrl(src);
    if (parsed && isPrivateStorageBucket(parsed.bucket)) setRetryKey((k) => k + 1);
  };

  return { resolved, retry };
}

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string; ttlSeconds?: number };

export function SignedImage({ src, ttlSeconds, onError, ...rest }: ImgProps) {
  const { resolved, retry } = useSignedSrc(src, ttlSeconds);
  if (!resolved) return null;
  return (
    <img
      {...rest}
      src={resolved}
      onError={(e) => {
        retry();
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
  const ref = useRef<HTMLVideoElement>(null);
  if (!resolved) return null;
  return (
    <video
      ref={ref}
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
  );
}
