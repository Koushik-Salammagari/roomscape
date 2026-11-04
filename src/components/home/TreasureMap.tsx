"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * The home hero: an inked room where a dotted trail draws itself from object
 * to object and ends at the X. This is the one orchestrated moment on the page.
 */
const STOPS = [
  { x: 75, y: 124, label: "lamp" },
  { x: 200, y: 58, label: "clock" },
  { x: 306, y: 96, label: "bookshelf" },
  { x: 312, y: 196, label: "plant" },
];
const X_MARK = { x: 168, y: 182 };
const TRAIL =
  "M75 124 C 110 60, 160 40, 200 58 S 280 70, 306 96 S 340 170, 312 196 S 230 230, 168 182";

export function TreasureMap() {
  const reduce = useReducedMotion();
  const draw = reduce ? 0 : 2.4;

  return (
    <svg
      viewBox="0 0 360 250"
      role="img"
      aria-label="A room drawn in ink, with a dotted trail from the lamp to the clock, the bookshelf and the plant, ending at an X on the sofa."
      className="w-full"
    >
      <defs>
        <radialGradient id="lamp-light" cx="75" cy="128" r="74" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--lantern)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--lantern)" stopOpacity="0" />
        </radialGradient>
        <mask id="trail-mask">
          <motion.path
            d={TRAIL}
            fill="none"
            stroke="#fff"
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: draw, ease: [0.45, 0, 0.2, 1], delay: 0.4 }}
          />
        </mask>
      </defs>

      <rect x="0" y="0" width="360" height="250" fill="url(#lamp-light)" />

      <g fill="none" stroke="var(--text-soft)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
        {/* floor and skirting */}
        <path d="M6 226 H354" />
        <path d="M6 232 H354" strokeOpacity="0.4" />
        {/* painting */}
        <rect x="34" y="30" width="86" height="58" rx="2" />
        <path d="M42 80 L64 58 L80 72 L92 62 L112 80" />
        {/* clock */}
        <circle cx="200" cy="58" r="17" />
        <path d="M200 58 V47 M200 58 L208 62" />
        {/* bookshelf */}
        <rect x="276" y="34" width="62" height="170" rx="2" />
        <path d="M276 76 H338 M276 120 H338 M276 164 H338" />
        <path d="M284 76 V52 M291 76 V48 M298 76 V55 M308 76 V50 M316 76 V58 M285 120 V96 M294 120 V92 M300 120 V100 M312 120 V94 M322 120 V98 M330 120 V92 M286 164 V140 M296 164 V136 M318 164 V142" strokeOpacity="0.6" />
        {/* lamp */}
        <path d="M60 108 H90 L84 138 H66 Z" />
        <path d="M75 138 V222 M62 224 H88" />
        {/* sofa */}
        <path d="M118 176 Q118 150 140 150 H226 Q248 150 248 176" />
        <path d="M108 222 V184 Q108 170 122 172 L126 196 H240 L244 172 Q258 170 258 184 V222" />
        <path d="M126 196 V214 H240 V196 M183 196 V214" strokeOpacity="0.6" />
        {/* plant */}
        <path d="M298 206 H326 L322 224 H302 Z" />
        <path d="M312 206 Q300 186 292 180 M312 206 Q318 182 330 176 M312 206 Q311 188 314 170" />
      </g>

      {/* the trail, revealed by the drawing mask */}
      <path
        d={TRAIL}
        fill="none"
        stroke="var(--lantern)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="2 7"
        mask="url(#trail-mask)"
      />

      {STOPS.map((stop, i) => (
        <motion.circle
          key={stop.label}
          cx={stop.x}
          cy={stop.y}
          r="5"
          fill="var(--lantern)"
          initial={{ scale: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.4 + (draw * (i + 0.15)) / 4.2 }}
          style={{ transformOrigin: `${stop.x}px ${stop.y}px` }}
        />
      ))}

      <motion.g
        initial={{ scale: reduce ? 1 : 0, rotate: reduce ? 0 : -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 11, delay: 0.4 + draw }}
        style={{ transformOrigin: `${X_MARK.x}px ${X_MARK.y}px` }}
      >
        <circle cx={X_MARK.x} cy={X_MARK.y} r="15" fill="var(--lantern)" opacity="0.18" />
        <path
          d={`M${X_MARK.x - 8} ${X_MARK.y - 8} L${X_MARK.x + 8} ${X_MARK.y + 8} M${X_MARK.x + 8} ${X_MARK.y - 8} L${X_MARK.x - 8} ${X_MARK.y + 8}`}
          stroke="var(--lantern)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </motion.g>
    </svg>
  );
}
