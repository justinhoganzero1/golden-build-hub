import { useState, useRef, useEffect, useCallback } from "react";
import { Zap, Vibrate, Waves, Mountain, Wind, Volume2, Play, Pause, Timer } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";

interface SoundScene {
  icon: React.ReactNode;
  title: string;
  desc: string;
  frequency: number;
  oscillator: OscillatorType;
  lfoFreq: number;
}

const scenes: SoundScene[] = [
  { icon: <Waves className="w-8 h-8" />, title: "Ocean Waves", desc: "Calming sea sounds with gentle vibration", frequency: 200, oscillator: "sine", lfoFreq: 0.15 },
  { icon: <Wind className="w-8 h-8" />, title: "Forest Breeze", desc: "Rustling leaves and bird songs", frequency: 350, oscillator: "triangle", lfoFreq: 0.3 },
  { icon: <Mountain className="w-8 h-8" />, title: "Mountain Rain", desc: "Gentle rainfall on mountain peaks", frequency: 150, oscillator: "sawtooth", lfoFreq: 0.2 },
  { icon: <Zap className="w-8 h-8" />, title: "Thunder Storm", desc: "Dramatic thunder with deep haptics", frequency: 80, oscillator: "square", lfoFreq: 0.5 },
];

const HapticEscapePage = () => {
  const [active, setActive] = useState<string | null>(null);
  const [volume, setVolume] = useState(80);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);

  const stopSound = useCallback(() => {
    nodesRef.current.forEach(n => { try { (n as OscillatorNode).stop?.(); } catch {} });
    nodesRef.current = [];
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setIsPlaying(false);
  }, []);

  const playScene = useCallback((scene: SoundScene) => {
    stopSound();
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const gain = ctx.createGain();
    gain.gain.value = (volume / 100) * 2.0; // Amplified volume range
    gain.connect(ctx.destination);
    gainRef.current = gain;

    // Main oscillator
    const osc = ctx.createOscillator();
    osc.type = scene.oscillator;
    osc.frequency.value = scene.frequency;

    // LFO for organic movement
    const lfo = ctx.createOscillator();
    lfo.frequency.value = scene.lfoFreq;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Secondary texture oscillator
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = scene.frequency * 1.5;
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.3;
    osc2.connect(osc2Gain);
    osc2Gain.connect(gain);

    // Noise layer
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.15;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 800;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(gain);

    osc.connect(gain);
    osc.start();
    osc2.start();
    lfo.start();
    noise.start();

    nodesRef.current = [osc, osc2, lfo, noise];
    setIsPlaying(true);

    // Haptic feedback
    if (navigator.vibrate) {
      const pattern = scene.title === "Thunder Storm" ? [200, 100, 400, 100, 200] : [100, 200];
      navigator.vibrate(pattern);
    }
  }, [volume, stopSound]);

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = (volume / 100) * 2.0;
    }
  }, [volume]);

  useEffect(() => () => stopSound(), [stopSound]);

  const toggleScene = (title: string) => {
    if (active === title) {
      stopSound();
      setActive(null);
    } else {
      setActive(title);
      const scene = scenes.find(s => s.title === title);
      if (scene) playScene(scene);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Vibrate className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Haptic Escape</h1><p className="text-muted-foreground text-xs">Immersive sensory experiences</p></div>
        </div>

        {/* Volume Control */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-primary" />
            <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(Number(e.target.value))}
              className="flex-1 accent-primary h-2" />
            <span className="text-xs text-foreground font-medium w-8 text-right">{volume}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 ml-8">Volume amplified for immersive experience</p>
        </div>

        <div className="space-y-3">
          {scenes.map(s => (
            <button key={s.title} onClick={() => toggleScene(s.title)}
              className={`w-full bg-card border rounded-xl p-5 flex items-center gap-4 text-left transition-all ${active === s.title ? "border-primary bg-primary/5 scale-[1.02]" : "border-border hover:border-primary"}`}>
              <div className={`text-primary ${active === s.title ? "animate-pulse" : ""}`}>{s.icon}</div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              {active === s.title ? (
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1,2,3,4].map(i => <div key={i} className="w-1 bg-primary rounded-full animate-pulse" style={{ height: `${8 + Math.random() * 12}px`, animationDelay: `${i * 0.1}s` }} />)}
                  </div>
                  <Pause className="w-4 h-4 text-primary" />
                </div>
              ) : (
                <Play className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HapticEscapePage;
