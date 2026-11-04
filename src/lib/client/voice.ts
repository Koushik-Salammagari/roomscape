"use client";

/**
 * Character voices use the phone's built-in speech, since Meta has no
 * text-to-speech model. Each voice style gets its own pitch and pace, and
 * each character a stable pick among the device's English voices.
 */
export type VoiceStyle = "low" | "high" | "warm" | "crisp" | "creaky";

const STYLE: Record<VoiceStyle, { pitch: number; rate: number }> = {
  low: { pitch: 0.7, rate: 0.92 },
  high: { pitch: 1.45, rate: 1.04 },
  warm: { pitch: 1.0, rate: 0.96 },
  crisp: { pitch: 1.15, rate: 1.08 },
  creaky: { pitch: 0.82, rate: 0.84 },
};

const MUTE_KEY = "roomscape:muted";

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* fine */
  }
  if (muted) window.speechSynthesis?.cancel();
}

function hash(s: string) {
  return [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
}

function voiceFor(name: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = english.length ? english : voices;
  return pool.length ? pool[hash(name) % pool.length] : undefined;
}

export type SpeakHandlers = { onWord?: (wordIndex: number) => void; onEnd?: () => void };

/**
 * Speaks a line and reports each word as it is said, so captions and motion
 * can follow. Phones that never send word events get an estimated pace.
 */
export function speak(text: string, style: VoiceStyle, name: string, handlers: SpeakHandlers = {}): () => void {
  const words = text.split(/\s+/).filter(Boolean);
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    handlers.onWord?.(words.length);
    handlers.onEnd?.();
  };

  const { pitch, rate } = STYLE[style] ?? STYLE.warm;
  // Without speech (muted or unsupported) the caption still types out at a reading pace.
  const paceMs = 330 / rate;
  const startPacer = (from = 0) => {
    let i = from;
    clearInterval(timer);
    timer = setInterval(() => {
      i += 1;
      handlers.onWord?.(i);
      if (i >= words.length) finish();
    }, paceMs);
  };

  if (!synth || isMuted()) {
    startPacer();
    return () => {
      done = true;
      clearInterval(timer);
    };
  }

  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.pitch = pitch;
  u.rate = rate;
  const v = voiceFor(name);
  if (v) u.voice = v;
  let sawBoundary = false;
  u.onboundary = (e) => {
    if (e.name && e.name !== "word") return;
    sawBoundary = true;
    clearInterval(timer);
    const spoken = text.slice(0, e.charIndex).split(/\s+/).filter(Boolean).length + 1;
    handlers.onWord?.(spoken);
  };
  u.onend = finish;
  u.onerror = finish;
  synth.speak(u);
  // If no word events arrive within half a second, pace the caption ourselves.
  setTimeout(() => {
    if (!sawBoundary && !done) startPacer();
  }, 500);

  return () => {
    done = true;
    clearInterval(timer);
    synth.cancel();
  };
}
