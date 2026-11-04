"use client";

/** A random id for this device's run of a game. Kept per browser so a refresh resumes. */
export function playerId(): string {
  try {
    let id = localStorage.getItem("roomscape:player");
    if (!id) {
      id = `p_${crypto.randomUUID().slice(0, 12)}`;
      localStorage.setItem("roomscape:player", id);
    }
    return id;
  } catch {
    return `p_${Math.random().toString(36).slice(2, 14)}`;
  }
}

/** Short haptic and sound cues. Sound is a soft synthesized chime, so nothing extra loads. */
export function cue(kind: "tap" | "wrong" | "unlock" | "open") {
  try {
    navigator.vibrate?.(kind === "unlock" ? [18, 40, 18, 40, 60] : kind === "wrong" ? [60] : kind === "open" ? [30, 50, 90] : 10);
    if (kind === "tap") return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = kind === "wrong" ? [196, 155] : kind === "open" ? [392, 523, 659, 784] : [523, 659, 784];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === "wrong" ? "triangle" : "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.11;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* sound and haptics are extras */
  }
}
