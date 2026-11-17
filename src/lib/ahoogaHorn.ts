// Old-fashioned "a-ooga" car horn, made on the device (no sound file, nothing paid).
export function playAhoogaHorn(volume = 0.5): void {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    const t = ctx.currentTime + 0.02;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.connect(ctx.destination);
    const tone = ctx.createBiquadFilter();
    tone.type = "bandpass";
    tone.frequency.value = 850;
    tone.Q.value = 1.1;
    tone.connect(out);

    const voices = [0, 7].map((detune) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.detune.value = detune;
      // "a-OO" rises, short gap, "ga" falls.
      osc.frequency.setValueAtTime(170, t);
      osc.frequency.exponentialRampToValueAtTime(350, t + 0.48);
      osc.frequency.setValueAtTime(340, t + 0.62);
      osc.frequency.linearRampToValueAtTime(290, t + 1.05);
      osc.connect(tone);
      return osc;
    });

    out.gain.exponentialRampToValueAtTime(volume, t + 0.06);
    out.gain.setValueAtTime(volume, t + 0.5);
    out.gain.exponentialRampToValueAtTime(0.03, t + 0.58);
    out.gain.exponentialRampToValueAtTime(volume, t + 0.64);
    out.gain.setValueAtTime(volume, t + 0.98);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 1.12);

    voices.forEach((o) => { o.start(t); o.stop(t + 1.15); });
    setTimeout(() => { void ctx.close().catch(() => {}); }, 1500);
  } catch {
    /* sound is a bonus — never break the alert */
  }
}
