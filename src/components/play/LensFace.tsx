"use client";

import { motion } from "framer-motion";
import type { VoiceStyle } from "@/lib/client/voice";

type Props = { style: VoiceStyle; speaking: boolean; width: number; accent?: string };

const INK = "#1b1a17";

/**
 * A face that sits on the real object in the camera. Each personality has its
 * own look: big sparkly eyes, sleepy lids, a detective's monocle, heavy brows.
 * Brows lift and the mouth moves while it talks; the eyes blink and glance about.
 */
export function LensFace({ style, speaking, width, accent = "#f0b54a" }: Props) {
  const blink = { scaleY: [1, 1, 0.08, 1] };
  const blinkT = { duration: 3.8, repeat: Infinity, times: [0, 0.9, 0.94, 1] };
  const look = { x: [0, 2.5, 2.5, -2.5, -2.5, 0], y: [0, 0, 1, 1, 0, 0] };
  const lookT = { duration: 7, repeat: Infinity, ease: "easeInOut" as const };
  const brow = speaking ? { y: [0, -4, 0, -2, 0] } : { y: 0 };
  const browT = speaking ? { duration: 0.9, repeat: Infinity } : { duration: 0.3 };

  const eye = (cx: number, opts: { r?: number; lid?: number; sparkle?: boolean; monocle?: boolean } = {}) => {
    const r = opts.r ?? 11;
    return (
      <g key={cx}>
        <motion.g style={{ originX: `${cx}px`, originY: "30px" }} animate={blink} transition={blinkT}>
          <ellipse cx={cx} cy={30} rx={r} ry={r * 1.12} fill="#fff" stroke={INK} strokeWidth={2.5} />
          <motion.g animate={look} transition={lookT}>
            <circle cx={cx} cy={31} r={r * 0.5} fill={INK} />
            {opts.sparkle ? (
              <>
                <circle cx={cx + r * 0.2} cy={31 - r * 0.25} r={r * 0.18} fill="#fff" />
                <circle cx={cx - r * 0.2} cy={31 + r * 0.2} r={r * 0.09} fill="#fff" />
              </>
            ) : (
              <circle cx={cx + r * 0.18} cy={31 - r * 0.2} r={r * 0.12} fill="#fff" />
            )}
          </motion.g>
          {opts.lid ? <rect x={cx - r - 2} y={30 - r * 1.2} width={r * 2 + 4} height={r * 1.2 * opts.lid} rx={3} fill={accent} stroke={INK} strokeWidth={2} /> : null}
        </motion.g>
        {opts.monocle ? (
          <>
            <circle cx={cx} cy={30} r={r + 4} fill="none" stroke="#d9a441" strokeWidth={2.5} />
            <path d={`M${cx + r + 3} ${34} q 6 12 2 26`} fill="none" stroke="#d9a441" strokeWidth={1.5} />
          </>
        ) : null}
      </g>
    );
  };

  const mouthOpen = speaking ? { scaleY: [0.3, 1, 0.45, 1.1, 0.3] } : { scaleY: 0.3 };
  const mouthT = speaking ? { duration: 0.55, repeat: Infinity } : { duration: 0.2 };

  let face: React.ReactNode;
  if (style === "high") {
    // Cheerful: huge sparkly eyes, rosy cheeks, a little round mouth.
    face = (
      <>
        <motion.g animate={brow} transition={browT}>
          <path d="M18 12 q 10 -7 20 0" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
          <path d="M62 12 q 10 -7 20 0" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
        </motion.g>
        {eye(28, { r: 13, sparkle: true })}
        {eye(72, { r: 13, sparkle: true })}
        <ellipse cx={16} cy={50} rx={7} ry={4} fill="#ff7a8a" opacity={0.6} />
        <ellipse cx={84} cy={50} rx={7} ry={4} fill="#ff7a8a" opacity={0.6} />
        <motion.ellipse cx={50} cy={58} rx={6} ry={7} fill="#5a1a1a" stroke={INK} strokeWidth={2.5} style={{ originX: "50px", originY: "58px" }} animate={mouthOpen} transition={mouthT} />
      </>
    );
  } else if (style === "creaky") {
    // Old and sleepy: heavy lids, wrinkled brows, a wobbly grin.
    face = (
      <>
        <motion.g animate={brow} transition={browT}>
          <path d="M14 14 q 12 4 24 -2" stroke="#e8e4da" strokeWidth={5} fill="none" strokeLinecap="round" />
          <path d="M62 12 q 12 6 24 2" stroke="#e8e4da" strokeWidth={5} fill="none" strokeLinecap="round" />
        </motion.g>
        {eye(28, { r: 10, lid: 0.55 })}
        {eye(72, { r: 10, lid: 0.55 })}
        <motion.path
          d="M34 56 q 16 10 32 0"
          stroke={INK}
          strokeWidth={3.5}
          fill="#5a1a1a"
          strokeLinecap="round"
          style={{ originX: "50px", originY: "58px" }}
          animate={speaking ? { scaleY: [0.6, 1.3, 0.8, 1.2, 0.6], rotate: [0, 2, -2, 1, 0] } : { scaleY: 0.6 }}
          transition={mouthT}
        />
      </>
    );
  } else if (style === "crisp") {
    // The detective: one raised brow, a monocle, a neat moustache.
    face = (
      <>
        <motion.g animate={brow} transition={browT}>
          <path d="M16 14 l 22 4" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
          <path d="M60 10 q 12 -6 24 2" stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        </motion.g>
        {eye(28, { r: 9 })}
        {eye(72, { r: 11, monocle: true })}
        <path d="M34 50 q 8 -6 16 0 q 8 -6 16 0 q -8 8 -16 2 q -8 6 -16 -2" fill="#3a2a1a" stroke={INK} strokeWidth={1.5} />
        <motion.ellipse cx={50} cy={61} rx={8} ry={4} fill="#5a1a1a" stroke={INK} strokeWidth={2} style={{ originX: "50px", originY: "61px" }} animate={mouthOpen} transition={mouthT} />
      </>
    );
  } else if (style === "low") {
    // Deep and grand: thick brows, wide calm eyes, a big mouth.
    face = (
      <>
        <motion.g animate={brow} transition={browT}>
          <path d="M14 14 l 26 6" stroke={INK} strokeWidth={6} strokeLinecap="round" />
          <path d="M86 14 l -26 6" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        </motion.g>
        {eye(28, { r: 10 })}
        {eye(72, { r: 10 })}
        <motion.rect x={34} y={52} width={32} height={12} rx={6} fill="#5a1a1a" stroke={INK} strokeWidth={2.5} style={{ originX: "50px", originY: "58px" }} animate={mouthOpen} transition={mouthT} />
      </>
    );
  } else {
    // Warm: friendly round eyes, soft brows, a big smile.
    face = (
      <>
        <motion.g animate={brow} transition={browT}>
          <path d="M18 13 q 10 -5 20 0" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
          <path d="M62 13 q 10 -5 20 0" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
        </motion.g>
        {eye(28, { r: 11 })}
        {eye(72, { r: 11 })}
        <ellipse cx={14} cy={50} rx={6} ry={3.5} fill="#ff9a8a" opacity={0.5} />
        <ellipse cx={86} cy={50} rx={6} ry={3.5} fill="#ff9a8a" opacity={0.5} />
        <motion.path
          d="M32 52 q 18 16 36 0 z"
          fill="#5a1a1a"
          stroke={INK}
          strokeWidth={2.5}
          strokeLinejoin="round"
          style={{ originX: "50px", originY: "52px" }}
          animate={speaking ? { scaleY: [0.5, 1.2, 0.7, 1.1, 0.5] } : { scaleY: 0.5 }}
          transition={mouthT}
        />
      </>
    );
  }

  return (
    <svg viewBox="0 0 100 72" width={width} height={width * 0.72} style={{ overflow: "visible", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.45))" }} aria-hidden>
      {face}
    </svg>
  );
}
