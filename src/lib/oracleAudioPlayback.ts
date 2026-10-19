// Use the gesture-unlocked element on every browser; unsupported MP3 streaming
// falls back to buffered playback without making another paid synthesis call.
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
          // Start from decoded audio time, not a large byte threshold.
          if (buffer.buffered.length && buffer.buffered.end(0) >= 0.15) await start();
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