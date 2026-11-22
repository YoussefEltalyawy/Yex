let ctx: AudioContext | null = null;

/** Soft synthesized bell — no audio assets needed. */
export function chime(kind: "done" | "start" = "done") {
  ctx ??= new AudioContext();
  const notes = kind === "done" ? [880, 1174.66, 1567.98] : [659.25, 880];
  notes.forEach((freq, i) => {
    const t = ctx!.currentTime + i * 0.16;
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 1.3);
  });
}
