"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { startRecording, type Recording } from "@/lib/client/recorder";
import { cue } from "@/lib/client/player";

type Turn = { role: "player" | "character"; text: string };

type Props = {
  gameId: string;
  stationId: string;
  player: string;
  name: string;
  /** Called with the character's reply, which the character then speaks. */
  onReply: (line: string) => void;
  onThinking: (thinking: boolean) => void;
};

/**
 * Hold to talk to the clue's character. The clip goes to Muse Voice Transcribe,
 * and Muse Spark Open answers in character. Typing works too, for quiet rooms.
 */
export function TalkBar({ gameId, stationId, player, name, onReply, onThinking }: Props) {
  const [state, setState] = useState<"idle" | "listening" | "thinking">("idle");
  const [heard, setHeard] = useState<string>("");
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [level, setLevel] = useState(0);
  const [note, setNote] = useState("");
  const rec = useRef<Recording | null>(null);
  const started = useRef(0);
  const meter = useRef<number>(0);
  const history = useRef<Turn[]>([]);

  const ask = async (payload: { audio?: Blob; text?: string }) => {
    setState("thinking");
    onThinking(true);
    try {
      const form = new FormData();
      form.append("meta", JSON.stringify({ player, stationId, text: payload.text, history: history.current }));
      if (payload.audio) form.append("audio", payload.audio, "clip.wav");
      const res = await fetch(`/api/games/${gameId}/play/talk`, { method: "POST", body: form });
      const body = (await res.json()) as { heard?: string; reply?: string; error?: string };
      if (!res.ok || !body.reply) throw new Error(body.error ?? "No reply");
      if (body.heard) {
        setHeard(body.heard);
        history.current.push({ role: "player", text: body.heard });
      }
      history.current.push({ role: "character", text: body.reply });
      history.current = history.current.slice(-10);
      onReply(body.reply);
    } catch {
      onReply(`Hmm, I lost my train of thought. Try asking me again.`);
    } finally {
      setState("idle");
      onThinking(false);
    }
  };

  const down = async (e: React.PointerEvent) => {
    e.preventDefault();
    if (state !== "idle") return;
    setNote("");
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      rec.current = await startRecording();
      started.current = Date.now();
      setState("listening");
      cue("tap");
      navigator.vibrate?.(12);
      const tick = () => {
        setLevel(rec.current?.level() ?? 0);
        meter.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setNote("The microphone is off. You can type your question instead.");
      setTyping(true);
    }
  };

  const up = async () => {
    cancelAnimationFrame(meter.current);
    const r = rec.current;
    rec.current = null;
    if (!r) return;
    if (Date.now() - started.current < 450) {
      r.cancel();
      setState("idle");
      setNote("Hold the button while you speak.");
      return;
    }
    const audio = await r.stop();
    await ask({ audio });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <motion.button
          type="button"
          onPointerDown={down}
          onPointerUp={up}
          onPointerCancel={up}
          onContextMenu={(e) => e.preventDefault()}
          disabled={state === "thinking"}
          aria-label={`Hold to talk to ${name}`}
          whileTap={{ scale: 0.94 }}
          className={clsx(
            "relative grid size-14 shrink-0 touch-none select-none place-items-center rounded-full border-2 transition-colors",
            state === "listening" ? "border-lantern bg-lantern text-night" : "border-lantern/60 bg-night-raised text-lantern",
          )}
        >
          {state === "listening" ? (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-lantern"
              animate={{ scale: 1 + Math.min(level * 6, 0.6) }}
              transition={{ duration: 0.08 }}
              aria-hidden
            />
          ) : null}
          {state === "thinking" ? <Dots /> : <MicIcon />}
        </motion.button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold">
            {state === "listening" ? "Listening… let go when you’re done" : state === "thinking" ? `${name} is thinking` : `Hold to talk to ${name}`}
          </span>
          <button type="button" onClick={() => setTyping((t) => !t)} className="self-start text-sm text-text-soft underline decoration-ink-line underline-offset-4">
            {typing ? "Hide the keyboard" : "Or type a question"}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {typing ? (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex gap-2 overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              const t = draft.trim();
              if (!t || state !== "idle") return;
              setDraft("");
              setHeard(t);
              void ask({ text: t });
            }}
          >
            <label htmlFor={`ask-${stationId}`} className="sr-only">
              Your question for {name}
            </label>
            <input
              id={`ask-${stationId}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Ask ${name} anything`}
              maxLength={300}
              className="min-h-12 min-w-0 flex-1 rounded-2xl border border-ink-line bg-night-deep px-4"
            />
            <button type="submit" disabled={!draft.trim() || state !== "idle"} className="min-h-12 rounded-2xl bg-night-raised px-4 font-semibold text-lantern disabled:opacity-40">
              Ask
            </button>
          </motion.form>
        ) : null}
      </AnimatePresence>

      {heard ? (
        <p className="text-sm text-text-soft">
          <span className="font-semibold text-text">You: </span>
          {heard}
        </p>
      ) : null}
      {note ? <p className="text-sm text-text-soft">{note}</p> : null}
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="relative size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function Dots() {
  return (
    <span className="flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="size-1.5 rounded-full bg-lantern" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </span>
  );
}
