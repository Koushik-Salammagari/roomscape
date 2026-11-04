"use client";

import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";

type CodeLockProps = {
  value: number[];
  onChange: (next: number[]) => void;
  unlocked?: boolean;
  label: string;
};

/** A combination lock with one rolling wheel per digit. */
export function CodeLock({ value, onChange, unlocked = false, label }: CodeLockProps) {
  const roll = (i: number, dir: 1 | -1) => {
    if (unlocked) return;
    const next = [...value];
    next[i] = (next[i] + dir + 10) % 10;
    onChange(next);
    navigator.vibrate?.(8);
  };

  return (
    <div className="flex flex-col items-center gap-5" aria-label={label}>
      <Padlock open={unlocked} />
      <div className="flex gap-2.5">
        {value.map((digit, i) => (
          <div
            key={i}
            className={clsx(
              "flex w-14 flex-col items-center overflow-hidden rounded-2xl border bg-night-deep",
              unlocked ? "border-tide" : "border-ink-line",
            )}
          >
            <button
              type="button"
              aria-label={`Digit ${i + 1} up`}
              onClick={() => roll(i, 1)}
              className="flex h-10 w-full items-center justify-center text-text-soft"
            >
              <Chevron up />
            </button>
            <div className="relative h-14 w-full" aria-live="polite">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={digit}
                  initial={{ y: -24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 24, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 34 }}
                  className="absolute inset-0 flex items-center justify-center font-mono text-3xl font-semibold"
                >
                  {digit}
                </motion.span>
              </AnimatePresence>
            </div>
            <button
              type="button"
              aria-label={`Digit ${i + 1} down`}
              onClick={() => roll(i, -1)}
              className="flex h-10 w-full items-center justify-center text-text-soft"
            >
              <Chevron />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className={up ? "" : "rotate-180"}>
      <path d="M4 11l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Padlock({ open }: { open: boolean }) {
  return (
    <svg width="72" height="84" viewBox="0 0 72 84" aria-hidden>
      <motion.path
        d="M18 40V26a18 18 0 0 1 36 0v14"
        fill="none"
        stroke="var(--lantern)"
        strokeWidth="7"
        strokeLinecap="round"
        animate={open ? { y: -14, rotate: -18, x: 6 } : { y: 0, rotate: 0, x: 0 }}
        style={{ originX: "54px", originY: "40px" }}
        transition={{ type: "spring", stiffness: 300, damping: 12 }}
      />
      <rect x="8" y="38" width="56" height="42" rx="10" fill="var(--lantern)" />
      <circle cx="36" cy="56" r="5" fill="var(--night)" />
      <rect x="34" y="58" width="4" height="10" rx="2" fill="var(--night)" />
    </svg>
  );
}
