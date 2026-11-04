"use client";

import { motion } from "framer-motion";

/** The unlock moment: lantern sparks bursting out from the centre. */
export function UnlockBurst() {
  const sparks = Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2 + (i % 3) * 0.2;
    const dist = 90 + (i % 5) * 26;
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, s: 4 + (i % 4) * 2, d: (i % 6) * 0.03 };
  });
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden" aria-hidden>
      <motion.div
        className="absolute size-40 rounded-full"
        style={{ background: "radial-gradient(circle, var(--lantern-glow) 0%, transparent 70%)" }}
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: 2.6, opacity: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      {sparks.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-lantern"
          style={{ width: p.s, height: p.s, boxShadow: "0 0 10px var(--lantern-glow)" }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.85, delay: p.d, ease: [0.2, 0.8, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
