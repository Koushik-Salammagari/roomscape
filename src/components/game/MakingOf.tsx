"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { MakingStep } from "@/lib/game/making";

/** "How this game was made": each Meta model and what it did for this room. */
export function MakingOf({ steps, open: startOpen = false }: { steps: MakingStep[]; open?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <section className="rounded-3xl border border-ink-line bg-night-raised/60">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left" aria-expanded={open}>
        <span className="flex flex-col">
          <span className="font-display text-lg">How this game was made</span>
          <span className="text-sm text-text-soft">{new Set(steps.map((s) => s.model)).size} Meta models worked on your room</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-text-soft" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.ol initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-3 px-4 pb-4">
              {steps.map((s, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex gap-3 border-l-2 border-lantern/40 pl-3"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs font-semibold tracking-wide text-lantern">{s.model}</span>
                    <span className="text-[0.95rem] leading-snug">{s.did}</span>
                  </span>
                </motion.li>
              ))}
            </div>
          </motion.ol>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
