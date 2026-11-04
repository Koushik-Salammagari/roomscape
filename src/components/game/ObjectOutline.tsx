"use client";

import { motion } from "framer-motion";
import type { Frame, RoomObject } from "@/lib/game/schema";

type Props = {
  frame: Frame;
  objects: RoomObject[];
  /** Object ids to draw with the solved colour. */
  highlight?: string[];
  /** Per-object colour overrides (CSS colour values). */
  colors?: Record<string, string>;
  /** Objects drawn dashed and faded, e.g. ones the host blocked. */
  muted?: string[];
  showLabels?: boolean;
  animate?: boolean;
};

/**
 * Draws SAM's mask for each object as an inked lantern outline over its frame.
 * The mask path lives in its own raster coordinates, so it is placed at its
 * bounds and scaled to them. Objects without a mask get a rounded box.
 */
export function ObjectOutline({ frame, objects, highlight = [], colors = {}, muted = [], showLabels = false, animate = true }: Props) {
  return (
    <svg
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {objects.map((o, i) => {
        const color = colors[o.id] ?? (highlight.includes(o.id) ? "var(--tide)" : "var(--lantern)");
        const faded = muted.includes(o.id);
        const sw = Math.max(frame.width, frame.height) / 260;
        const delay = animate ? i * 0.12 : 0;
        if (o.maskPath && o.maskBounds && o.maskSize) {
          const sx = (o.maskBounds.right - o.maskBounds.left) / o.maskSize.width;
          const sy = (o.maskBounds.bottom - o.maskBounds.top) / o.maskSize.height;
          return (
            <g key={o.id} transform={`translate(${o.maskBounds.left} ${o.maskBounds.top}) scale(${sx} ${sy})`}>
              <motion.path
                d={o.maskPath}
                fill={color}
                fillOpacity={0.14}
                stroke={color}
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
                strokeDasharray={faded ? "6 6" : undefined}
                opacity={faded ? 0.55 : 1}
                initial={animate ? { pathLength: 0, fillOpacity: 0 } : false}
                animate={{ pathLength: 1, fillOpacity: faded ? 0.05 : 0.14 }}
                transition={{ duration: 0.9, delay, ease: "easeOut" }}
              />
            </g>
          );
        }
        const w = o.box.right - o.box.left;
        const h = o.box.bottom - o.box.top;
        return (
          <g key={o.id}>
            <motion.rect
              x={o.box.left}
              y={o.box.top}
              width={w}
              height={h}
              rx={Math.min(w, h) * 0.12}
              fill={color}
              fillOpacity={0.1}
              stroke={color}
              strokeWidth={sw}
              strokeDasharray={faded ? `${sw * 3} ${sw * 3}` : undefined}
              initial={animate ? { pathLength: 0, opacity: 0 } : false}
              animate={{ pathLength: 1, opacity: faded ? 0.5 : 1 }}
              transition={{ duration: 0.8, delay, ease: "easeOut" }}
            />
            {showLabels ? (
              <text
                x={o.box.left + sw * 2}
                y={o.box.top - sw * 2}
                fill={color}
                fontSize={sw * 7}
                fontWeight={700}
                style={{ paintOrder: "stroke", stroke: "var(--night-deep)", strokeWidth: sw * 2 }}
              >
                {o.name}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
