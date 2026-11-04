"use client";

import { motion } from "framer-motion";
import type { Frame, RoomObject } from "@/lib/game/schema";

type Props = {
  frame: Frame;
  objects: RoomObject[];
  /** Object ids to draw with the solved colour. */
  highlight?: string[];
  showLabels?: boolean;
};

/**
 * Draws SAM's mask for each object as an inked lantern outline over its frame.
 * The mask path lives in its own raster coordinates, so it is placed at its
 * bounds and scaled to them. Objects without a mask get a rounded box.
 */
export function ObjectOutline({ frame, objects, highlight = [], showLabels = false }: Props) {
  return (
    <svg
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {objects.map((o, i) => {
        const color = highlight.includes(o.id) ? "var(--tide)" : "var(--lantern)";
        const sw = Math.max(frame.width, frame.height) / 260;
        const delay = i * 0.12;
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
                initial={{ pathLength: 0, fillOpacity: 0 }}
                animate={{ pathLength: 1, fillOpacity: 0.14 }}
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
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
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
