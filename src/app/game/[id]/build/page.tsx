"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { StepList, type StepState } from "@/components/game/StepList";
import { fetchGame, postJSON, readLines } from "@/lib/client/game";
import type { PlayerGame } from "@/lib/game/view";

type Designed = {
  title: string;
  intro: string;
  designedBy: string;
  stations: { id: string; type: string; title: string; character: { name: string; art?: string } }[];
  notes: string[];
};

type ArtMsg =
  | { kind: "scene"; url: string }
  | { kind: "character" | "fragment"; stationId: string; url: string }
  | { kind: "skipped"; what: string; reason: string }
  | { done: true; scene?: string; sceneFrame?: number };

export default function BuildTheater({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const started = useRef(false);

  const [game, setGame] = useState<PlayerGame | null>(null);
  const [design, setDesign] = useState<Designed | null>(null);
  const [scene, setScene] = useState<string | null>(null);
  const [portraits, setPortraits] = useState<Record<string, string>>({});
  const [state, setState] = useState<Record<"design" | "check" | "paint", StepState>>({
    design: "waiting",
    check: "waiting",
    paint: "waiting",
  });
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const run = async () => {
    setError(null);
    let step: "design" | "check" | "paint" = "design";
    try {
      const g = await fetchGame<PlayerGame>(id);
      setGame(g);
      document.documentElement.dataset.theme = g.theme;

      setState((s) => ({ ...s, design: "active" }));
      // The blind solve runs inside the design request; show it starting partway through.
      const checkTimer = setTimeout(() => setState((s) => ({ ...s, check: "active" })), 18_000);
      const d = await postJSON<Designed>(`/api/games/${id}/build/design`);
      clearTimeout(checkTimer);
      setDesign(d);
      setState((s) => ({ ...s, design: "done", check: "done" }));

      step = "paint";
      setState((s) => ({ ...s, paint: "active" }));
      const res = await fetch(`/api/games/${id}/build/art`, { method: "POST" });
      await readLines<ArtMsg>(res, (msg) => {
        if ("done" in msg) {
          if (msg.scene) setScene(msg.scene);
          return;
        }
        if (msg.kind === "scene") setScene(msg.url);
        if (msg.kind === "character") setPortraits((p) => ({ ...p, [msg.stationId]: msg.url }));
      });
      setState((s) => ({ ...s, paint: "done" }));
      setReady(true);
      navigator.vibrate?.([20, 40, 20]);
    } catch (e) {
      setState((s) => ({ ...s, [step]: "failed" }));
      setError(e instanceof Error ? e.message : "Building the game failed.");
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const frame = game?.room.frames[game.plan?.sceneFrame ?? 0] ?? game?.room.frames[0];
  const stations = design?.stations ?? [];

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 pb-10"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
        paddingRight: "max(1.25rem, env(safe-area-inset-right))",
      }}
    >
      <div className="relative -mx-5 aspect-[4/5] overflow-hidden sm:mx-0 sm:rounded-[28px]">
        {frame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={frame.url} alt="Your room" className="absolute inset-0 h-full w-full object-cover saturate-50" />
        ) : (
          <div className="absolute inset-0 bg-night-deep" />
        )}
        <AnimatePresence>
          {scene ? (
            <motion.img
              key="scene"
              src={scene}
              alt="Your room, painted into the story"
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ clipPath: "circle(0% at 50% 55%)" }}
              animate={{ clipPath: "circle(120% at 50% 55%)" }}
              transition={{ duration: 2.2, ease: [0.6, 0, 0.2, 1] }}
            />
          ) : null}
        </AnimatePresence>
        {!scene ? (
          <motion.div
            className="absolute inset-0"
            style={{ background: "radial-gradient(circle at 50% 55%, transparent 0%, var(--night) 75%)" }}
            animate={{ opacity: [0.55, 0.85, 0.55] }}
            transition={{ duration: 3.2, repeat: Infinity }}
          />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-night to-transparent" />
        <div className="absolute inset-x-5 bottom-5">
          <AnimatePresence mode="wait">
            {design ? (
              <motion.h1
                key="title"
                className="font-display text-[2.4rem] leading-[1.02]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                {design.title}
              </motion.h1>
            ) : (
              <motion.div key="wait" exit={{ opacity: 0 }} className="flex flex-col gap-2">
                <motion.p className="font-display text-2xl text-text" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.4, repeat: Infinity }}>
                  Your story is being written…
                </motion.p>
                {game && !error ? <Ticker names={game.room.objects.filter((o) => o.status !== "dropped").map((o) => o.name)} checking={state.check === "active"} /> : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {design ? (
        <motion.p
          className="text-lg leading-relaxed text-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
        >
          {design.intro}
        </motion.p>
      ) : null}

      <StepList
        steps={[
          { id: "design", label: "Writing the story and puzzles", model: design?.designedBy ?? "Muse Wonder 1.0", state: state.design },
          {
            id: "check",
            label: "Testing every puzzle before you play",
            model: "Muse Spark 1.3 solves each one blind; code checks every answer",
            state: state.check,
            note: design?.notes.join(" "),
          },
          { id: "paint", label: "Painting your room and its characters", model: "Muse Image 1.0", state: state.paint },
        ]}
      />

      {stations.length ? (
        <section className="flex flex-col gap-3" aria-label="Characters in this story">
          <h2 className="text-base font-semibold">Who you’ll meet</h2>
          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {stations.map((s, i) => (
              <div key={s.id} className="flex w-20 shrink-0 flex-col items-center gap-2 text-center">
                <div className="relative size-20 overflow-hidden rounded-full border-2 border-ink-line bg-night-raised">
                  <AnimatePresence>
                    {(s.type === "riddle-hunt" || s.type === "picture-fragment") && game?.mode !== "host" ? (
                      <span className="absolute inset-0 grid place-items-center" title="Hiding until you find it">
                        <span className="flex gap-2.5" aria-hidden>
                          <span className="h-2 w-3 rounded-full bg-lantern shadow-[0_0_8px_var(--lantern)]" />
                          <span className="h-2 w-3 rounded-full bg-lantern shadow-[0_0_8px_var(--lantern)]" />
                        </span>
                      </span>
                    ) : portraits[s.id] ? (
                      <motion.img
                        src={portraits[s.id]}
                        alt={s.character.name}
                        className="absolute inset-0 h-full w-full object-cover"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 380, damping: 18 }}
                      />
                    ) : (
                      <motion.span
                        className="absolute inset-0 grid place-items-center font-display text-2xl text-text-soft"
                        animate={{ opacity: [0.4, 0.9, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                      >
                        ?
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <span className="text-xs leading-tight text-text-soft">
                  {(s.type === "riddle-hunt" || s.type === "picture-fragment") && game?.mode !== "host" ? "Hiding" : s.character.name}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}


      {error ? (
        <div className="flex flex-col gap-3 rounded-3xl border border-danger/50 bg-night-raised p-4">
          <p className="text-sm">{error}</p>
          <Button variant="quiet" onClick={run}>
            Try again
          </Button>
        </div>
      ) : null}

      <AnimatePresence>
        {ready ? (
          <motion.div
            className="sticky bottom-0 -mx-5 bg-gradient-to-t from-night via-night/95 to-transparent px-5 pt-6 pb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              className="min-h-14 w-full text-lg"
              onClick={() => router.push(`/game/${id}/${game?.mode === "host" ? "preview" : "play"}`)}
            >
              {game?.mode === "host" ? "Preview the hunt" : "Open the case"}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

/** While the designer works, say what is happening, in terms of the player's own things. */
function Ticker({ names, checking }: { names: string[]; checking: boolean }) {
  const [i, setI] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    const r = setInterval(() => setI((n) => n + 1), 3800);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, []);
  const pick = (k: number) => names[(i * 7 + k * 3) % Math.max(1, names.length)] ?? "lamp";
  const lines = checking
    ? [
        "Muse Spark is solving every riddle without the answers",
        `Making sure only one thing in the room fits the clue about the ${pick(1)}`,
        "Checking that every digit adds up to the final lock",
        "Rewriting any riddle that has two answers",
      ]
    : [
        `Muse Wonder is reading the ${names.length} things in your room`,
        `Deciding who the ${pick(0)} is in this story`,
        `Writing a riddle only the ${pick(2)} can answer`,
        `Giving the ${pick(4)} a voice`,
        "Hiding a digit of the final lock in each clue",
        "Writing three hints for every clue, from gentle to obvious",
      ];
  const line = lines[i % lines.length];
  return (
    <div className="flex items-start gap-2 text-sm text-text-soft">
      <span className="font-mono tabular-nums text-lantern">
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
      </span>
      <AnimatePresence mode="wait">
        <motion.span key={line} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }} className="min-w-0 leading-snug">
          {line}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
