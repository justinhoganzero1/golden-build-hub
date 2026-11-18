// Use the gesture-unlocked element on every browser; unsupported MP3 streaming
// falls back to buffered playback without making another paid synthesis call.
export const STREAM_START_SECONDS = 0.5;

/**
 * Plays audio that was fully downloaded while the previous sentence was still
 * speaking, so the next sentence starts straight away with no gap or stutter.
 */
export async function playOracleAudioBlob(
  audio: HTMLAudioElement,
  blob: Blob,
  isLive: () => boolean,
  onSpeaking: (speaking: boolean) => void,
): Promise<boolean> {
  if (!blob || blob.size < 100 || !isLive()) return false;
  const objectUrl = URL.createObjectURL(blob);
  let watchdog: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const ended = new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Audio playback failed"));
      timeout = setTimeout(() => reject(new Error("Playback stalled")), 90000);
      watchdog = setInterval(() => { if (!isLive()) reject(new Error("Playback cancelled")); }, 100);
    });
    void ended.catch(() => {});
    audio.src = objectUrl;
    await audio.play();
    onSpeaking(true);
    await ended;
    return isLive();
  } catch {
    return false;
  } finally {
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    if (watchdog) clearInterval(watchdog);
    if (timeout) clearTimeout(timeout);
    URL.revokeObjectURL(objectUrl);
    onSpeaking(false);
  }
}

export async function playOracleAudio(
  audio: HTMLAudioElement,
  response: Response,
  isLive: () => boolean,
  onSpeaking: (speaking: boolean) => void,
): Promise<boolean> {
  const supportsStreaming = typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg");
  let objectUrl = "";
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let stop: (() => void) | undefined;
  let watchdog: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const ended = new Promise<void>((resolve, reject) => {
      stop = () => reject(new Error("Playback cancelled"));
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Audio playback failed"));
      timeout = setTimeout(() => reject(new Error("Playback stalled")), 60000);
      watchdog = setInterval(() => { if (!isLive()) stop?.(); }, 100);
    });
    // Attach a rejection handler while preparing/reading the stream.
    void ended.catch(() => {});
    if (supportsStreaming && response.body) {
      const source = new MediaSource();
      objectUrl = URL.createObjectURL(source);
      const opened = new Promise<void>((resolve) => {
        source.addEventListener("sourceopen", () => resolve(), { once: true });
      });
      audio.src = objectUrl;
      audio.load();
      await Promise.race([opened, ended]);
      const buffer = source.addSourceBuffer("audio/mpeg");
      reader = response.body.getReader();
      let started = false;
      const start = async () => {
        if (started) return;
        if (!isLive()) throw new Error("Playback cancelled");
        await audio.play();
        started = true;
        onSpeaking(true);
      };
      const receive = async () => {
        if (!reader) return;
        while (isLive()) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.byteLength) continue;
          await new Promise<void>((resolve, reject) => {
            buffer.addEventListener("updateend", () => resolve(), { once: true });
            buffer.addEventListener("error", () => reject(new Error("Invalid audio stream")), { once: true });
            buffer.appendBuffer(value as BufferSource);
          });
          // Start once about half a second is decoded: a tiny head start made her
          // voice stutter on phone networks when the next bytes arrived late.
          if (buffer.buffered.length && buffer.buffered.end(0) >= STREAM_START_SECONDS) await start();
        }
        if (!isLive()) throw new Error("Playback cancelled");
        if (source.readyState === "open") source.endOfStream();
        await start();
        await ended;
      };
      await Promise.race([receive(), ended]);
    } else {
      const blob = await Promise.race([response.blob(), ended.then(() => { throw new Error("Playback ended early"); })]);
      if (!blob.type.includes("audio") || blob.size < 100 || !isLive()) return false;
      objectUrl = URL.createObjectURL(blob);
      audio.src = objectUrl;
      await audio.play();
      onSpeaking(true);
      await ended;
    }
    return isLive();
  } catch {
    return false;
  } finally {
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    if (watchdog) clearInterval(watchdog);
    if (timeout) clearTimeout(timeout);
    if (reader) void reader.cancel().catch(() => {});
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    onSpeaking(false);
  }
}
/**
 * Oracle's next sentences, downloading in the background while she is still
 * talking. When it's their turn they play from what has already arrived and
 * keep streaming the rest, so she never waits for the whole run to finish.
 */
export class PrefetchedSpeech {
  private chunks: Uint8Array[] = [];
  private waiters: Array<() => void> = [];
  done = false;
  failed = false;
  /** true once real audio started arriving; false if the request failed. */
  readonly ready: Promise<boolean>;

  constructor(response: Promise<Response | null>) {
    this.ready = response.then((r) => {
      if (!r?.body) { this.finish(true); return false; }
      void this.pump(r.body.getReader());
      return true;
    }).catch(() => { this.finish(true); return false; });
  }

  private notify() {
    const w = this.waiters; this.waiters = [];
    for (const fn of w) fn();
  }

  private finish(failed: boolean) {
    if (failed) this.failed = true;
    this.done = true;
    this.notify();
  }

  private async pump(reader: ReadableStreamDefaultReader<Uint8Array>) {
    let failed = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value?.byteLength) { this.chunks.push(value); this.notify(); }
      }
    } catch {
      failed = true;
    }
    this.finish(failed);
  }

  get complete() { return this.done && !this.failed && this.chunks.length > 0; }

  blob(): Blob { return new Blob(this.chunks as BlobPart[], { type: "audio/mpeg" }); }

  /** What has arrived so far, then the rest as it comes. */
  toResponse(): Response {
    let i = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull: async (controller) => {
        while (i >= this.chunks.length && !this.done) await new Promise<void>((r) => this.waiters.push(r));
        if (i < this.chunks.length) controller.enqueue(this.chunks[i++]);
        else controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "audio/mpeg" } });
  }
}
