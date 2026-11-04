"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { isMuted, setMuted, speak, type VoiceStyle } from "@/lib/client/voice";

type Props = {
  name: string;
  /** Muse Image portrait. */
  art?: string;
  /** The object's own close-up, used with a drawn face when there is no portrait. */
  crop?: string;
  /** A hiding character shows as a silhouette with glowing eyes. */
  hiding?: boolean;
  line?: string;
  voice?: VoiceStyle;
  size?: "sm" | "lg";
  /** Speak the line aloud when it changes. */
  talk?: boolean;
  /** Shows a thinking bubble while a reply is on its way. */
  thinking?: boolean;
  /** Told when the voice starts and stops, so the real object can move in time. */
  onSpeaking?: (speaking: boolean) => void;
};

/**
 * A talking clue object. It breathes while idle, blinks, bounces on every
 * word it says, and its speech bubble types out in time with its voice.
 */
export function Character({ name, art, crop, hiding = false, line, voice = "warm", size = "lg", talk = true, thinking = false, onSpeaking }: Props) {
  const [shown, setShown] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMute] = useState(false);
  const bounce = useAnimationControls();
  const words = (line ?? "").split(/\s+/).filter(Boolean);
  const stop = useRef<() => void>(() => {});

  useEffect(() => setMute(isMuted()), []);
  useEffect(() => onSpeaking?.(speaking), [speaking, onSpeaking]);

  useEffect(() => {
    if (!line) return;
    setShown(0);
    if (!talk) {
      setShown(words.length);
      return;
    }
    setSpeaking(true);
    stop.current = speak(line, voice, name, {
      onWord: (i) => {
        setShown(i);
        bounce.start({ scaleY: [1, 1.07, 0.97, 1], scaleX: [1, 0.97, 1.02, 1], transition: { duration: 0.28 } });
      },
      onEnd: () => setSpeaking(false),
    });
    return () => stop.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, talk, voice, name]);

  const px = size === "lg" ? "size-28" : "size-14";

  return (
    <div className="flex items-end gap-3">
      <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }} className="relative shrink-0">
        {speaking ? (
          <motion.span
            className="absolute -inset-2 rounded-full border-2 border-lantern"
            animate={{ scale: [1, 1.12, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.1, repeat: Infinity }}
            aria-hidden
          />
        ) : null}
        <motion.div
          animate={bounce}
          style={{ originY: 1 }}
          className={`relative ${px} overflow-hidden rounded-full border-2 ${hiding ? "border-ink-line" : "border-lantern/60"} bg-night-raised`}
        >
          {hiding ? (
            <Silhouette speaking={speaking} />
          ) : art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art} alt={name} className="h-full w-full object-cover" />
          ) : (
            <>
              {crop ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={crop} alt={name} className="h-full w-full object-cover" />
              ) : (
                <span className="absolute inset-0 bg-gradient-to-b from-night-raised to-night-deep" />
              )}
              <Face speaking={speaking} />
            </>
          )}
        </motion.div>
      </motion.div>

      <AnimatePresence mode="wait">
        {thinking ? (
          <motion.div
            key="thinking"
            className="mb-3 flex gap-1.5 rounded-2xl rounded-bl-sm border border-ink-line bg-night-raised px-4 py-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            aria-label={`${name} is thinking`}
          >
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="size-2 rounded-full bg-lantern" animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.14 }} />
            ))}
          </motion.div>
        ) : line ? (
          <motion.div
            key={line}
            className="relative mb-3 min-w-0 flex-1 rounded-2xl rounded-bl-sm border border-ink-line bg-night-raised px-4 py-3"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-lantern">{name}</p>
              {talk ? (
                <button
                  type="button"
                  onClick={() => {
                    setMuted(!muted);
                    setMute(!muted);
                  }}
                  className="-m-1 rounded-lg p-1 text-text-soft"
                  aria-label={muted ? "Turn voices on" : "Turn voices off"}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                    <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />
                    {muted ? (
                      <path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    ) : (
                      <path d="M11 5.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    )}
                  </svg>
                </button>
              ) : null}
            </div>
            <p className="text-[0.95rem] leading-snug" aria-live="polite">
              {words.map((w, i) => (
                <span key={i} className={i < shown ? "opacity-100" : "opacity-25"} style={{ transition: "opacity 0.15s" }}>
                  {w}{" "}
                </span>
              ))}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Two eyes and a mouth drawn over an object's own photo: the eyes blink, the mouth moves while talking. */
function Face({ speaking }: { speaking: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
      <g fill="#fff" stroke="#1b1a17" strokeWidth="2">
        <motion.ellipse cx="36" cy="44" rx="9" ry="10" animate={{ ry: [10, 10, 1, 10] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.92, 0.96, 1] }} />
        <motion.ellipse cx="64" cy="44" rx="9" ry="10" animate={{ ry: [10, 10, 1, 10] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.92, 0.96, 1] }} />
      </g>
      <circle cx="38" cy="46" r="4" fill="#1b1a17" />
      <circle cx="66" cy="46" r="4" fill="#1b1a17" />
      <motion.ellipse
        cx="50"
        cy="70"
        rx="9"
        fill="#3a1414"
        stroke="#1b1a17"
        strokeWidth="2"
        animate={speaking ? { ry: [2, 7, 3, 8, 2] } : { ry: 2.5 }}
        transition={speaking ? { duration: 0.6, repeat: Infinity } : { duration: 0.2 }}
      />
    </svg>
  );
}

/** A hiding character: a dark shape with glowing eyes that blink. */
function Silhouette({ speaking }: { speaking: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="hide-bg" cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="var(--night-raised)" />
          <stop offset="1" stopColor="var(--night-deep)" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#hide-bg)" />
      <motion.path
        d="M50 18 C 72 18 80 40 78 62 C 76 82 64 92 50 92 C 36 92 24 82 22 62 C 20 40 28 18 50 18 Z"
        fill="#000"
        opacity="0.55"
        animate={{ scale: speaking ? [1, 1.04, 1] : 1 }}
        transition={{ duration: 0.5, repeat: speaking ? Infinity : 0 }}
        style={{ originX: "50px", originY: "90px" }}
      />
      {[38, 62].map((x) => (
        <motion.ellipse
          key={x}
          cx={x}
          cy="48"
          rx="6"
          ry="4"
          fill="var(--lantern)"
          style={{ filter: "drop-shadow(0 0 4px var(--lantern))" }}
          animate={{ ry: [4, 4, 0.6, 4] }}
          transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.9, 0.95, 1] }}
        />
      ))}
      <text x="50" y="80" textAnchor="middle" fontSize="11" fill="var(--text-soft)" fontFamily="var(--font-display)">
        ?
      </text>
    </svg>
  );
}
