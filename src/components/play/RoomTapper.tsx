"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import type { Frame } from "@/lib/game/schema";

type Props = { frames: Frame[]; onTap: (tap: { frame: number; x: number; y: number }) => void; busy?: boolean };

/** Remote play: the room's photos, and the player taps the object the clue points to. */
export function RoomTapper({ frames, onTap, busy }: Props) {
  const [index, setIndex] = useState(0);
  const [mark, setMark] = useState<{ x: number; y: number } | null>(null);
  const frame = frames[index];

  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (busy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    setMark({ x: rx, y: ry });
    onTap({ frame: index, x: rx * frame.width, y: ry * frame.height });
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative w-full cursor-crosshair overflow-hidden rounded-2xl border border-ink-line"
        style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
        onClick={tap}
        role="button"
        aria-label="Tap the object in this photo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frame.url} alt={`Room photo ${index + 1}`} className="absolute inset-0 h-full w-full select-none" draggable={false} />
        {mark ? (
          <motion.span
            key={`${mark.x}-${mark.y}`}
            className="absolute size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-lantern"
            style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }}
            initial={{ scale: 0.3, opacity: 1 }}
            animate={{ scale: 1.4, opacity: 0.2 }}
            transition={{ duration: 0.6 }}
          />
        ) : null}
      </div>
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {frames.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setIndex(i);
              setMark(null);
            }}
            className={clsx("relative h-14 w-11 shrink-0 overflow-hidden rounded-lg border-2", i === index ? "border-lantern" : "border-ink-line")}
            aria-label={`Show room photo ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
