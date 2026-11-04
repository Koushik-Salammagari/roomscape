"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { ObjectOutline } from "@/components/game/ObjectOutline";
import { cropObject, grabFrame, photoToFrame, type LocalFrame } from "@/lib/client/images";
import type { Frame, RoomObject } from "@/lib/game/schema";

const TARGET_FRAMES = 8;
const MIN_FRAMES = 4;
const FRAME_EVERY_MS = 3000;

type Phase = "camera" | "capturing" | "processing" | "done";
type StepId = "read" | "mask" | "check";
type StepState = "waiting" | "active" | "done" | "failed";

const STEPS: { id: StepId; label: string; model: string }[] = [
  { id: "read", label: "Reading your room", model: "Muse Spark 1.3" },
  { id: "mask", label: "Outlining every object", model: "SAM 3.1" },
  { id: "check", label: "Checking every detail twice", model: "Muse Spark 1.3" },
];

async function postJSON<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

function ScanScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = (params.get("mode") ?? "quick") as "host" | "quick";
  const theme = params.get("theme") ?? "lost-treasure";
  const difficulty = params.get("difficulty") ?? "normal";

  const video = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const gameId = useRef<string | null>(null);
  const uploads = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = useRef(0);

  const [phase, setPhase] = useState<Phase>("camera");
  const [camera, setCamera] = useState<"asking" | "live" | "blocked">("asking");
  const [local, setLocal] = useState<LocalFrame[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [objects, setObjects] = useState<RoomObject[]>([]);
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState<Record<StepId, StepState>>({ read: "waiting", mask: "waiting", check: "waiting" });
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (video.current) video.current.srcObject = stream;
        setCamera("live");
      })
      .catch(() => setCamera("blocked"));
    if (!navigator.mediaDevices) setCamera("blocked");
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const ensureGame = useCallback(async () => {
    if (gameId.current) return gameId.current;
    const { id } = await postJSON<{ id: string }>("/api/games", { mode, theme, difficulty });
    gameId.current = id;
    return id;
  }, [mode, theme, difficulty]);

  /** Frames upload in the background while the player keeps scanning. */
  const queueUpload = useCallback(
    (frame: LocalFrame) => {
      uploads.current = uploads.current.then(async () => {
        const id = await ensureGame();
        const form = new FormData();
        form.append("frame", frame.blob, "frame.jpg");
        form.append("width", String(frame.width));
        form.append("height", String(frame.height));
        const res = await fetch(`/api/games/${id}/frames`, { method: "POST", body: form });
        if (!res.ok) throw new Error("A frame failed to upload. Check your connection and scan again.");
        const { frame: stored } = (await res.json()) as { frame: Frame };
        setFrames((f) => [...f, stored]);
      });
    },
    [ensureGame],
  );

  const addFrame = useCallback(
    (frame: LocalFrame) => {
      if (count.current >= TARGET_FRAMES) return;
      count.current += 1;
      setLocal((l) => [...l, frame]);
      queueUpload(frame);
      navigator.vibrate?.(12);
    },
    [queueUpload],
  );

  const stopCapture = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const startCapture = async () => {
    if (!video.current) return;
    setPhase("capturing");
    addFrame(await grabFrame(video.current));
    timer.current = setInterval(async () => {
      if (!video.current || count.current >= TARGET_FRAMES) return;
      addFrame(await grabFrame(video.current));
    }, FRAME_EVERY_MS);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    stopCapture();
    setPhase("capturing");
    for (const file of [...files].slice(0, TARGET_FRAMES)) addFrame(await photoToFrame(file));
  };

  useEffect(() => {
    if (phase === "capturing" && local.length >= TARGET_FRAMES) stopCapture();
  }, [phase, local.length, stopCapture]);

  const setStep = (id: StepId, state: StepState) => setSteps((s) => ({ ...s, [id]: state }));

  const process = async () => {
    stopCapture();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setPhase("processing");
    setError(null);
    let step: StepId = "read";
    try {
      await uploads.current;
      const id = gameId.current!;

      if (steps.read !== "done") {
        setStep("read", "active");
        const read = await postJSON<{ summary: string; objects: RoomObject[] }>(`/api/games/${id}/scan/read`);
        setSummary(read.summary);
        setObjects(read.objects);
        setStep("read", "done");
      }

      step = "mask";
      setStep("mask", "active");
      const res = await fetch(`/api/games/${id}/scan/mask`, { method: "POST" });
      if (!res.ok || !res.body) throw new Error("Outlining the objects failed.");
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let masked: RoomObject[] = [];
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const msg = JSON.parse(line) as { object?: RoomObject };
          if (msg.object) {
            masked = [...masked.filter((o) => o.id !== msg.object!.id), msg.object];
            setObjects((all) => all.map((o) => (o.id === msg.object!.id ? msg.object! : o)));
          }
        }
      }
      setStep("mask", "done");

      step = "check";
      setStep("check", "active");
      const withFacts = masked.filter((o) => o.facts.length);
      const crops = await Promise.all(
        withFacts.map(async (o) => ({ objectId: o.id, dataUrl: await cropObject(local[o.frame].dataUrl, o.box) })),
      );
      let latest = masked;
      for (let i = 0; i < Math.max(crops.length, 1); i += 6) {
        const batch = crops.slice(i, i + 6);
        const out = await postJSON<{ objects: RoomObject[] }>(`/api/games/${id}/scan/check`, {
          crops: batch,
          last: i + 6 >= crops.length,
        });
        latest = out.objects;
        setObjects(out.objects);
      }
      setObjects(latest);
      setStep("check", "done");
      setPhase("done");
    } catch (e) {
      setStep(step, "failed");
      setError(e instanceof Error ? e.message : "Something went wrong while reading the room.");
    }
  };

  // While processing, cycle through frames so the outlines can be watched filling in.
  useEffect(() => {
    if (phase !== "processing" || !local.length) return;
    const t = setInterval(() => setShown((s) => (s + 1) % local.length), 2200);
    return () => clearInterval(t);
  }, [phase, local.length]);

  const usable = objects.filter((o) => o.status === "verified" || o.status === "masked");
  const checked = objects.filter((o) => o.status === "verified");
  const progress = local.length / TARGET_FRAMES;

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 pb-8"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
        paddingRight: "max(1.25rem, env(safe-area-inset-right))",
      }}
    >
      <header className="flex items-center justify-between">
        <Link href="/" className="-ml-2 rounded-xl px-2 py-2 text-sm text-text-soft">
          Back
        </Link>
        <span className="text-sm text-text-soft">{mode === "host" ? "Host a hunt" : "Quick play"}</span>
      </header>

      {phase === "camera" || phase === "capturing" ? (
        <>
          <h1 className="font-display text-[2rem] leading-tight">
            {phase === "camera" ? "Show Roomscape your room" : local.length >= TARGET_FRAMES ? "That’s the whole room" : "Keep walking slowly"}
          </h1>
          <p className="-mt-2 text-text-soft">
            {phase === "camera"
              ? "Stand in the doorway, tap start, then walk slowly along the walls. Point at shelves, tables and anything with detail."
              : local.length >= TARGET_FRAMES
                ? "Tap read the room when you’re ready."
                : "Pause on shelves and tables. Roomscape grabs a picture every few seconds."}
          </p>

          <div className="relative aspect-[3/4] overflow-hidden rounded-[28px] border border-ink-line bg-night-deep">
            <video ref={video} autoPlay playsInline muted className="h-full w-full object-cover" />
            <Brackets />
            {local.length && camera !== "live" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={local.at(-1)!.dataUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            {camera === "blocked" && !local.length ? (
              <div className="absolute inset-0 grid place-items-center p-8 text-center">
                <p className="text-text-soft">
                  The camera isn’t available here. Allow camera access in your browser settings, or add photos of the room instead.
                </p>
              </div>
            ) : null}
            <AnimatePresence>
              {phase === "capturing" && local.length ? (
                <motion.div
                  key={local.length}
                  className="pointer-events-none absolute inset-0 bg-white"
                  initial={{ opacity: 0.55 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                />
              ) : null}
            </AnimatePresence>
          </div>

          <Filmstrip frames={local} />

          <div className="flex flex-col items-center gap-3">
            {phase === "camera" ? (
              <Button onClick={startCapture} disabled={camera !== "live"} className="min-h-14 w-full text-lg">
                Start scanning
              </Button>
            ) : (
              <Button onClick={process} disabled={local.length < MIN_FRAMES} className="min-h-14 w-full text-lg">
                {local.length < MIN_FRAMES ? `Scanning: ${local.length} of ${TARGET_FRAMES}` : "Read the room"}
              </Button>
            )}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-night-deep" aria-hidden>
              <motion.div className="h-full bg-lantern" animate={{ width: `${Math.min(progress, 1) * 100}%` }} />
            </div>
            <label className="cursor-pointer text-sm text-text-soft underline decoration-ink-line underline-offset-4">
              Add photos of the room instead
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
            </label>
          </div>
        </>
      ) : null}

      {phase === "processing" ? (
        <>
          <h1 className="font-display text-[2rem] leading-tight">Getting to know your room</h1>
          <div className="relative aspect-[3/4] overflow-hidden rounded-[28px] border border-ink-line bg-night-deep">
            <AnimatePresence mode="popLayout">
              {local[shown] ? (
                <motion.img
                  key={shown}
                  src={local[shown].dataUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6 }}
                />
              ) : null}
            </AnimatePresence>
            {frames[shown] ? (
              <ObjectOutline
                key={`o-${shown}`}
                frame={frames[shown]}
                objects={objects.filter((o) => o.frame === shown && o.status !== "listed")}
              />
            ) : null}
          </div>
          <StepList steps={steps} />
          {error ? (
            <div className="flex flex-col gap-3 rounded-3xl border border-danger/50 bg-night-raised p-4">
              <p className="text-sm">{error}</p>
              <Button variant="quiet" onClick={process}>
                Try that step again
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {phase === "done" ? (
        <>
          <h1 className="font-display text-[2rem] leading-tight">
            {usable.length} things in your room can hide a clue
          </h1>
          <p className="-mt-2 text-text-soft">
            {summary} Roomscape read the details of {checked.length} of them twice, so puzzles can rely on them.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {local.map((f, i) =>
              frames[i] ? (
                <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-ink-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.dataUrl} alt={`Scan picture ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                  <ObjectOutline frame={frames[i]} objects={usable.filter((o) => o.frame === i)} />
                </div>
              ) : null,
            )}
          </div>
          <ul className="flex flex-wrap gap-2">
            {usable.map((o) => (
              <li
                key={o.id}
                className={clsx(
                  "rounded-full border px-3 py-1 text-sm",
                  o.status === "verified" ? "border-lantern/60 text-text" : "border-ink-line text-text-soft",
                )}
              >
                {o.name}
              </li>
            ))}
          </ul>
          <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-night via-night/95 to-transparent px-5 pt-6 pb-2">
            <Button
              className="min-h-14 w-full text-lg"
              onClick={() => router.push(`/game/${gameId.current}/${mode === "host" ? "setup" : "build"}`)}
            >
              {mode === "host" ? "Choose where the gift is hidden" : "Build my game"}
            </Button>
          </div>
        </>
      ) : null}
    </main>
  );
}

function Brackets() {
  const corner = "absolute size-9 border-lantern/80";
  return (
    <div className="pointer-events-none absolute inset-4" aria-hidden>
      <span className={`${corner} left-0 top-0 rounded-tl-2xl border-l-[3px] border-t-[3px]`} />
      <span className={`${corner} right-0 top-0 rounded-tr-2xl border-r-[3px] border-t-[3px]`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-2xl border-b-[3px] border-l-[3px]`} />
      <span className={`${corner} bottom-0 right-0 rounded-br-2xl border-b-[3px] border-r-[3px]`} />
    </div>
  );
}

function Filmstrip({ frames }: { frames: LocalFrame[] }) {
  return (
    <div className="flex h-16 gap-2" aria-label={`${frames.length} pictures taken`}>
      {Array.from({ length: TARGET_FRAMES }, (_, i) => (
        <div key={i} className="relative flex-1 overflow-hidden rounded-xl border border-ink-line bg-night-deep">
          <AnimatePresence>
            {frames[i] ? (
              <motion.img
                src={frames[i].dataUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              />
            ) : null}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function StepList({ steps }: { steps: Record<StepId, StepState> }) {
  return (
    <ol className="flex flex-col gap-3">
      {STEPS.map((s) => {
        const state = steps[s.id];
        return (
          <li key={s.id} className="flex items-center gap-3">
            <span
              className={clsx(
                "grid size-7 shrink-0 place-items-center rounded-full border-2",
                state === "done" && "border-tide bg-tide text-night",
                state === "active" && "border-lantern",
                state === "waiting" && "border-ink-line",
                state === "failed" && "border-danger",
              )}
              aria-hidden
            >
              {state === "done" ? (
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <path d="M3 7.5l2.5 2.5L11 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              ) : state === "active" ? (
                <span className="size-2.5 animate-ping rounded-full bg-lantern" />
              ) : null}
            </span>
            <span className="flex flex-col">
              <span className={clsx("font-semibold", state === "waiting" && "text-text-soft")}>{s.label}</span>
              <span className="text-xs text-text-soft">{s.model}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function ScanPage() {
  return (
    <Suspense>
      <ScanScreen />
    </Suspense>
  );
}
