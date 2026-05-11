// Centralized image generation client with client-side cache and configurable
// retry/backoff. The matching server fallback chain lives in
// supabase/functions/image-gen/index.ts.
import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";

const CACHE_PREFIX = "og_img_cache_v1::";
// Maximum number of fallbacks the server will run for a single call.
// Set to 100 by default per Justin's request — server clamps to 1..100.
const DEFAULT_MAX_ATTEMPTS = 100;
// Number of times the *client* will re-issue the entire request if it gets
// nothing back at all (network drop, 5xx). 1 try == 1 server invocation, and
// each server invocation already runs up to maxAttempts model calls.
const DEFAULT_CLIENT_TRIES = 4;

async function hash(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input.trim().toLowerCase());
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function readCache(key: string): { url: string; libraryId?: string } | null {
  try {
    const v = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!v) return null;
    try {
      const parsed = JSON.parse(v);
      if (parsed?.url) return { url: parsed.url, libraryId: parsed.libraryId };
    } catch { /* old cache stored raw url */ }
    return { url: v };
  } catch { return null; }
}
function writeCache(key: string, url: string, libraryId?: string) {
  try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ url, libraryId })); } catch {}
}

export interface GenerateImageOptions {
  prompt: string;
  inputImage?: string;
  tier?: "fast" | "premium";
  /** Server fallback count — max 100, default 100. */
  maxAttempts?: number;
  /** Override the model fallback order. Items repeat until maxAttempts is hit. */
  modelChain?: string[];
  /** Allow returning the most recent saved library image when generation fails. */
  libraryFallback?: boolean;
  /** Skip session/server cache for forced fresh re-roll. */
  noCache?: boolean;
  /** Owner-bypass for M-rated content. */
  ownerBypass?: boolean;
}

export interface GenerateImageResult {
  url: string;
  cached: boolean;
  fallback: boolean;
  attempts: number;
  jobId?: string;
  libraryId?: string;
  model?: string;
}

export class InsufficientCreditsError extends Error {
  constructor() { super("Out of AI credits."); }
}
export class ImageGenError extends Error {
  detail?: string;
  constructor(msg: string, detail?: string) { super(msg); this.detail = detail; }
}

export async function generateImage(opts: GenerateImageOptions): Promise<GenerateImageResult> {
  const {
    prompt, inputImage, tier, maxAttempts = DEFAULT_MAX_ATTEMPTS,
    modelChain, libraryFallback = true, noCache = false, ownerBypass,
  } = opts;

  const cacheKey = await hash(`${prompt}|${inputImage || ""}|${tier || ""}`);
  if (!noCache) {
    const cached = readCache(cacheKey);
    if (cached) return { url: cached.url, cached: true, fallback: false, attempts: 0, libraryId: cached.libraryId };
  }

  let lastErr = "";
  for (let attempt = 1; attempt <= DEFAULT_CLIENT_TRIES; attempt++) {
    try {
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
        body: JSON.stringify({
          prompt, inputImage, tier, ownerBypass,
          maxAttempts, modelChain, libraryFallback,
          useCache: !noCache,
        }),
      });
      if (r.status === 402) throw new InsufficientCreditsError();
      if (!r.ok) {
        lastErr = `HTTP ${r.status}`;
      } else {
        const data = await r.json();
        const url = data?.images?.[0]?.image_url?.url || data?.images?.[0]?.url || data?.images?.[0];
        if (url) {
          const libraryId = data.library_id || data.libraryId;
          writeCache(cacheKey, url, libraryId);
          return {
            url,
            cached: !!data.cached,
            fallback: !!data.fallback,
            attempts: data.attempts || 0,
            jobId: data.job_id,
            libraryId,
            model: data.model,
          };
        }
        lastErr = data?.error || "no image returned";
      }
    } catch (e: any) {
      if (e instanceof InsufficientCreditsError) throw e;
      lastErr = e?.message || "network error";
    }
    if (attempt < DEFAULT_CLIENT_TRIES) {
      await new Promise(res => setTimeout(res, 600 * attempt));
    }
  }
  throw new ImageGenError("Image generation failed", lastErr);
}
