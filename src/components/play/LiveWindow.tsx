"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

type Props = {
  /** Shown when there is no camera (remote play, or the camera is off). */
  still?: string;
  name: string;
  art?: string;
  speaking?: boolean;
  /** Use the live back camera. */
  camera: boolean;
};

/**
 * The object you are talking to, through your own camera: the live picture
 * fills the window and the character's portrait glows in the corner.
 */
export function LiveWindow({ still, name, art, speaking = false, camera }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
        setOn(true);
      })
      .catch(() => setOn(false));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [camera]);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-ink-line bg-night-deep">
      {camera ? <video ref={video} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" /> : null}
      {!on && still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={still} alt={name} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-night/80 via-transparent to-transparent" />
      {on ? (
        <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-night/70 px-2.5 py-1 text-xs font-semibold backdrop-blur">
          <motion.span className="size-2 rounded-full bg-danger" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
          Live
        </span>
      ) : null}
      <div className="absolute right-3 bottom-3 left-3 flex items-end gap-3">
        <motion.div
          className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-lantern bg-night-raised shadow-[0_0_24px_var(--lantern)]"
          animate={speaking ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={speaking ? { duration: 0.5, repeat: Infinity } : undefined}
        >
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art} alt={name} className="h-full w-full object-cover" />
          ) : still ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={still} alt={name} className="h-full w-full object-cover" />
          ) : null}
        </motion.div>
        <p className="pb-1 font-display text-xl leading-tight drop-shadow">{name}</p>
      </div>
    </div>
  );
}
