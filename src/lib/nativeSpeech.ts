/**
 * The installed Android / Google TV app runs inside a WebView, which has no
 * working browser speech recognition — so Oracle's mic button did nothing.
 * This stand-in speaks the same language as the browser's SpeechRecognition
 * but uses the device's own free speech service (the TV remote's mic works
 * too). Nothing is paid and nothing new is stored.
 */
import { SpeechRecognition as NativeSR } from "@capacitor-community/speech-recognition";

type Handler = ((e?: any) => void) | null;

function resultEvent(text: string, isFinal: boolean) {
  const alt = [{ transcript: text, confidence: 1 }] as any;
  alt.isFinal = isFinal;
  return { resultIndex: 0, results: [alt] };
}

export class NativeSpeechRecognition {
  lang = "en-AU";
  continuous = false;
  interimResults = true;
  maxAlternatives = 1;
  onstart: Handler = null;
  onresult: Handler = null;
  onerror: Handler = null;
  onend: Handler = null;
  onspeechend: Handler = null;
  onsoundend: Handler = null;

  private running = false;
  private latest = "";
  private handles: Array<{ remove: () => Promise<void> }> = [];

  start() {
    if (this.running) throw new Error("InvalidStateError: already started");
    this.running = true;
    this.latest = "";
    void this.begin();
  }

  stop() {
    void NativeSR.stop().catch(() => this.finish());
  }

  abort() {
    this.latest = "";
    void NativeSR.stop().catch(() => {});
    this.finish("aborted");
  }

  private async begin() {
    try {
      let perm = await NativeSR.checkPermissions();
      if (perm.speechRecognition !== "granted") perm = await NativeSR.requestPermissions();
      if (perm.speechRecognition !== "granted") return this.finish("not-allowed");
      const { available } = await NativeSR.available();
      if (!available) return this.finish("service-not-allowed");

      this.handles.push(await NativeSR.addListener("partialResults", (data: { matches?: string[] }) => {
        const text = (data?.matches?.[0] || "").trim();
        if (!text || !this.running) return;
        this.latest = text;
        this.onresult?.(resultEvent(text, false));
      }));
      this.handles.push(await NativeSR.addListener("listeningState", (data: { status: string }) => {
        if (data?.status === "started") this.onstart?.();
        if (data?.status === "stopped") this.finish();
      }));

      await NativeSR.start({ language: this.lang || "en-AU", partialResults: true, popup: false, maxResults: 1 });
    } catch (err) {
      const msg = String((err as Error)?.message || err || "");
      this.finish(/permission/i.test(msg) ? "not-allowed" : /no match|no speech|didn't understand/i.test(msg) ? "no-speech" : "network");
    }
  }

  private finish(error?: string) {
    if (!this.running) return;
    this.running = false;
    const text = this.latest;
    this.latest = "";
    const handles = this.handles.splice(0);
    handles.forEach((h) => { void h.remove().catch(() => {}); });
    if (error) this.onerror?.({ error });
    else if (text) { this.onresult?.(resultEvent(text, true)); this.onspeechend?.(); }
    else this.onerror?.({ error: "no-speech" });
    this.onend?.();
  }
}

/** Swap in the device speech service inside the installed Android/TV app. */
export function installNativeSpeech() {
  const w = window as any;
  w.SpeechRecognition = NativeSpeechRecognition;
  w.webkitSpeechRecognition = NativeSpeechRecognition;
}
