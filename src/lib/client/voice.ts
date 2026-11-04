"use client";

/**
 * Character voices use the phone's built-in speech, since Meta has no
 * text-to-speech model. Each voice style gets its own pitch and pace, and
 * each character a stable pick among the device's English voices.
 */
export type VoiceStyle = "low" | "high" | "warm" | "crisp" | "creaky";

// Gentle shifts only: big pitch or speed changes are what make phone voices sound robotic.
const STYLE: Record<VoiceStyle, { pitch: number; rate: number }> = {
  low: { pitch: 0.9, rate: 0.9 },
  high: { pitch: 1.12, rate: 0.95 },
  warm: { pitch: 1.0, rate: 0.92 },
  crisp: { pitch: 1.05, rate: 0.97 },
  creaky: { pitch: 0.93, rate: 0.86 },
};

/** Novelty and old formant voices that ship on Apple devices and sound robotic. */
const ROBOTIC = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley|hysterical)\b/i;
/** Natural voices, best first. */
const NATURAL = ["samantha", "daniel", "karen", "moira", "tessa", "serena", "arthur", "martha", "catherine", "gordon", "aaron", "nicky", "rishi", "google us english", "google uk english"];

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

function quality(v: SpeechSynthesisVoice): number {
  const id = `${v.name} ${v.voiceURI}`.toLowerCase();
  if (/premium/.test(id)) return 3;
  if (/enhanced|neural|natural/.test(id)) return 2;
  return NATURAL.some((n) => id.includes(n)) ? 1 : 0;
}

function voiceFor(name: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en") && !ROBOTIC.test(v.name));
  if (!english.length) return undefined;
  // Use only the best quality available on this device, then give each character a stable pick.
  const best = Math.max(...english.map(quality));
  const pool = english.filter((v) => quality(v) === best).sort((a, b) => a.name.localeCompare(b.name));
  return pool[hash(name) % pool.length];
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
  // Speak phrase by phrase: the short gap between utterances reads as a natural pause at commas and full stops.
  const phrases = text.match(/[^,.;:!?—]+[,.;:!?—]*\s*/g) ?? [text];
  const v = voiceFor(name);
  let sawBoundary = false;
  let offset = 0;
  phrases.forEach((phrase, k) => {
    const start = offset;
    offset += phrase.length;
    const u = new SpeechSynthesisUtterance(phrase.trim());
    u.pitch = pitch;
    u.rate = rate * 0.96;
    if (v) u.voice = v;
    u.onboundary = (e) => {
      if (e.name && e.name !== "word") return;
      sawBoundary = true;
      clearInterval(timer);
      const spoken = text.slice(0, start + e.charIndex).split(/\s+/).filter(Boolean).length + 1;
      handlers.onWord?.(spoken);
    };
    if (k === phrases.length - 1) {
      u.onend = finish;
      u.onerror = finish;
    }
    synth.speak(u);
  });
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
