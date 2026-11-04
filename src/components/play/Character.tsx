"use client";

import { motion } from "framer-motion";

type Props = { name: string; art?: string; line?: string; size?: "sm" | "lg" };

/** A station's character: its portrait breathes gently and its line appears in a speech bubble. */
export function Character({ name, art, line, size = "lg" }: Props) {
  const px = size === "lg" ? "size-28" : "size-14";
  return (
    <div className="flex items-end gap-3">
      <motion.div
        className={`relative ${px} shrink-0 overflow-hidden rounded-full border-2 border-lantern/60 bg-night-raised`}
        animate={{ scaleY: [1, 1.035, 1], y: [0, -2, 0] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ originY: 1 }}
      >
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center font-display text-3xl text-lantern">{name.replace(/^The /, "")[0]}</span>
        )}
      </motion.div>
      {line ? (
        <motion.div
          key={line}
          className="relative mb-3 rounded-2xl rounded-bl-sm border border-ink-line bg-night-raised px-4 py-3"
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
        >
          <p className="text-xs font-semibold text-lantern">{name}</p>
          <p className="text-[0.95rem] leading-snug">{line}</p>
        </motion.div>
      ) : null}
    </div>
  );
}
