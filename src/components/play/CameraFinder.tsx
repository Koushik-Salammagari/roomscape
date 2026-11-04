"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ObjectOutline } from "@/components/game/ObjectOutline";
import { grabFrame } from "@/lib/client/images";
import type { RoomObject } from "@/lib/game/schema";

export type Shot = { dataUrl: string; width: number; height: number };
export type FindResult = { correct: boolean; message?: string; outline?: Pick<RoomObject, "box" | "maskPath" | "maskBounds" | "maskSize"> };

type Props = { onShot: (shot: Shot) => Promise<FindResult>; onClose: () => void; onFound: () => void };

/** Full-screen camera: point at the object, tap the shutter, and SAM's outline glows on what you found. */
export function CameraFinder({ onShot, onClose, onFound }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState<"asking" | "on" | "blocked">("asking");
  const [shot, setShot] = useState<Shot | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<FindResult | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
        setLive("on");
      })
      .catch(() => setLive("blocked"));
    if (!navigator.mediaDevices) setLive("blocked");
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const capture = async () => {
    if (!video.current) return;
    const frame = await grabFrame(video.current);
    const s = { dataUrl: frame.dataUrl, width: frame.width, height: frame.height };
    setShot(s);
    setChecking(true);
    setResult(null);
    try {
      const r = await onShot(s);
      setResult(r);
      if (r.correct) setTimeout(onFound, 1700);
    } catch (e) {
      setResult({ correct: false, message: e instanceof Error ? e.message : "That check failed. Try again." });
    } finally {
      setChecking(false);
    }
  };

  const retry = () => {
    setShot(null);
    setResult(null);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-night-deep"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        {shot ? (
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot.dataUrl} alt="Your picture" className="absolute inset-0 h-full w-full object-cover" />
            {result?.correct && result.outline ? (
              <ObjectOutline
                frame={{ id: "shot", url: "", width: shot.width, height: shot.height }}
                objects={[{ id: "found", name: "", phrase: "", frame: 0, facts: [], status: "masked", reachable: true, ...result.outline }]}
              />
            ) : null}
          </div>
        ) : null}
        {checking ? (
          <motion.div
            className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-lantern/30 to-transparent"
            initial={{ top: "-15%" }}
            animate={{ top: "105%" }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-8 rounded-[32px] border-2 border-lantern/50" />
        <button
          type="button"
          onClick={onClose}
          className="absolute left-4 top-4 rounded-full bg-night/70 px-4 py-2 text-sm backdrop-blur"
        >
          Close
        </button>
        {live === "blocked" ? (
          <p className="absolute inset-0 grid place-items-center p-10 text-center text-text-soft">
            The camera isn’t available. Close this and tap the object in the room photos instead.
          </p>
        ) : null}
        <AnimatePresence>
          {result ? (
            <motion.div
              className="absolute inset-x-4 bottom-4 rounded-2xl border border-ink-line bg-night/85 p-4 backdrop-blur"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className={result.correct ? "font-semibold text-lantern" : ""}>
                {result.correct ? "That’s it. The clue is yours." : result.message}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="flex flex-col gap-2 px-5 pt-4">
        {result && !result.correct ? (
          <Button onClick={retry} className="min-h-14 w-full text-lg">
            Try another angle
          </Button>
        ) : (
          <Button onClick={capture} busy={checking} disabled={live !== "on" || Boolean(shot)} className="min-h-14 w-full text-lg">
            {checking ? "Checking with SAM 3.1" : "This is it"}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
