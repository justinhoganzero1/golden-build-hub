// Builds the 3-minute hosted preview of "Scam the Scammer — Juzzy Style".
// Host: Olivia Vance. Includes a 20s live two-avatar interview with the hero.
// Generates ElevenLabs VO, per-frame lip-sync envelopes, and the timeline JSON.
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT_AUDIO = path.join(root, "public/preview3/vo");
fs.mkdirSync(OUT_AUDIO, { recursive: true });

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error("ELEVENLABS_API_KEY missing");

const OLIVIA = "cgSgspJ2msm6clMCkdW9"; // Jessica — expressive female presenter
const JUZZY = "IKne3meq5aSn9XLyUdCD"; // Charlie — Australian male

const FPS = 30;

// mode: "studio" = full-frame host, "corner" = host over story still,
//       "interview" = two heads facing each other.
const SEG = [
  { id: 0, s: "o", mode: "studio", plate: true, gapAfter: 0.35, text:
    "G'day, I'm Olivia Vance, and welcome to the Oracle Lunar screening room." },
  { id: 1, s: "o", mode: "studio", plate: true, gapAfter: 0.5, text:
    "Before we start, one thing, straight up. Everything you're about to see is for entertainment purposes only. None of these thoughts, none of these scenes, none of these people are real. Every frame, every voice, every word of it was made up and generated inside the Oracle Lunar app. Nobody was hurt, nothing happened, it's a story. Right. Now let's get into it." },

  { id: 2, s: "o", mode: "corner", img: 0, gapAfter: 0.2, text:
    "This is Scam the Scammer, Juzzy Style. Three minutes of a twenty chapter Aussie revenge thriller written, illustrated, narrated and cut into a film without a single camera being switched on." },
  { id: 3, s: "o", mode: "corner", img: 1, gapAfter: 0.15, text:
    "It opens in a tin shed in Western Sydney, in the kind of heat that bends the air. Juzzy's best mate Macca is gone, bled dry by a call centre full of digital parasites." },
  { id: 4, s: "o", mode: "corner", img: 2, gapAfter: 0.15, text:
    "Juzzy is not a cop. He's a bloke built like an angle grinder with two monitors, a stolen life to account for, and absolutely nothing left to lose." },
  { id: 5, s: "o", mode: "corner", img: 4, gapAfter: 0.15, text:
    "He spoofs a rogue cell tower in a rain hammered cul de sac and pulls the syndicate's encrypted chatter straight out of the storm." },
  { id: 6, s: "o", mode: "corner", img: 7, gapAfter: 0.15, text:
    "That signal drags him into a Smithfield warehouse, then a bunker, then a floor full of stolen phones humming like a beehive." },
  { id: 7, s: "o", mode: "corner", img: 13, gapAfter: 0.15, text:
    "From there the film goes international. Bangkok at night. Neon off wet bitumen. A boss who has never once had to look a victim in the eye." },
  { id: 8, s: "o", mode: "corner", img: 17, gapAfter: 0.15, text:
    "There's a frozen vault, a zero day payload, and a ledger of everything they ever took. And Juzzy is about to make that ledger public." },
  { id: 19, s: "o", mode: "corner", img: 20, gapAfter: 0.15, text:
    "Chapter fourteen is where it turns into digital warfare. He doesn't rob them. He makes every account they hold pay itself back, cent by cent, in front of them." },
  { id: 9, s: "o", mode: "corner", img: 25, gapAfter: 0.15, text:
    "The back half moves to Surfers Paradise, high rise glass, surveillance rigs and a card table where the devil orders a second drink." },
  { id: 20, s: "o", mode: "corner", img: 30, gapAfter: 0.3, text:
    "And the poker table scene is the best twelve pages in the book. One hand, two liars, and a phone face down on the felt." },
  { id: 10, s: "o", mode: "corner", img: 35, gapAfter: 0.35, text:
    "Then the alarm goes, a kill squad deploys, and the last five chapters are close quarters, point blank, no escape route." },

  // ---- 20 second live interview ----
  { id: 11, s: "o", mode: "interview", gapAfter: 0.12, text:
    "Juzzy, you're live with me. Twenty seconds. Why not just hand it to the police?" },
  { id: 12, s: "j", mode: "interview", gapAfter: 0.12, text:
    "Police had six months, love. Macca had six days. I didn't want an arrest. I wanted the ledger on every screen they own." },
  { id: 13, s: "o", mode: "interview", gapAfter: 0.12, text:
    "And the ending. Would you do it again?" },
  { id: 14, s: "j", mode: "interview", gapAfter: 0.35, text:
    "Every single time. Balanced forever, mate." },

  { id: 15, s: "o", mode: "corner", img: 40, gapAfter: 0.15, text:
    "That interview never happened. Neither did he. Both faces, both voices and every scene behind me came out of one app." },
  { id: 16, s: "o", mode: "studio", plate: true, gapAfter: 0.15, text:
    "Twenty chapters, thirty six thousand words, forty two illustrations, a full narrated cut and this hosted preview. One prompt, one afternoon." },
  { id: 17, s: "o", mode: "studio", plate: false, gapAfter: 0.9, text:
    "Write yours at oracle dash lunar dot online. I'm Olivia Vance. Entertainment only, remember. Goodnight." },
];

/* ---------------- TTS ---------------- */
async function tts(text, voice, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 2000) return;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.45,
          use_speaker_boost: true,
          speed: 1.0,
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const dur = (f) =>
  parseFloat(
    execFileSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1", f,
    ]).toString().trim(),
  );

/** Per-frame normalised RMS envelope for procedural lip-sync. */
function envelope(file, seconds) {
  const raw = execFileSync("ffmpeg", [
    "-v", "error", "-i", file, "-ac", "1", "-ar", "16000",
    "-f", "s16le", "-",
  ], { maxBuffer: 1 << 28 });
  const samples = new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2);
  const frames = Math.max(1, Math.ceil(seconds * FPS));
  const per = Math.max(1, Math.floor(samples.length / frames));
  const out = new Array(frames).fill(0);
  let peak = 1e-4;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const a = f * per, b = Math.min(samples.length, a + per);
    for (let i = a; i < b; i++) { const v = samples[i] / 32768; sum += v * v; }
    const rms = Math.sqrt(sum / Math.max(1, b - a));
    out[f] = rms;
    if (rms > peak) peak = rms;
  }
  return out.map((v) => +Math.min(1, Math.pow(v / peak, 0.6)).toFixed(3));
}

const segments = [];
let t = 0;
for (let i = 0; i < SEG.length; i++) {
  const seg = SEG[i];
  const name = `${String(seg.id).padStart(2, "0")}.mp3`;
  const file = path.join(OUT_AUDIO, name);
  await tts(seg.text, seg.s === "o" ? OLIVIA : JUZZY, file);
  const d = dur(file);
  segments.push({
    i,
    speaker: seg.s,
    mode: seg.mode,
    img: seg.img ?? null,
    plate: !!seg.plate,
    text: seg.text,
    start: +t.toFixed(3),
    dur: +d.toFixed(3),
    env: envelope(file, d),
    audio: `preview3/vo/${name}`,
  });
  t += d + (seg.gapAfter ?? 0.2);
  console.log(`${name} ${d.toFixed(2)}s  (${seg.mode})  total ${t.toFixed(1)}s`);
}

const interview = segments.filter((s) => s.mode === "interview");
const ivLen = interview.length
  ? interview[interview.length - 1].start + interview[interview.length - 1].dur - interview[0].start
  : 0;
console.log("interview length:", ivLen.toFixed(2), "s");

const data = { fps: FPS, total: +(t + 1.2).toFixed(3), segments };
fs.writeFileSync(path.join(root, "src/preview3-data.json"), JSON.stringify(data, null, 1));
console.log("TOTAL", data.total.toFixed(1), "s ->", (data.total / 60).toFixed(2), "min");
