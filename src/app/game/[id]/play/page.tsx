"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { CodeLock } from "@/components/ui/CodeLock";
import { PaperCard } from "@/components/ui/PaperCard";
import { MakingOf } from "@/components/game/MakingOf";
import { StationScreen, type Board } from "@/components/play/StationScreen";
import { UnlockBurst } from "@/components/play/UnlockBurst";
import { fetchGame, postJSON } from "@/lib/client/game";
import { cue, playerId } from "@/lib/client/player";
import type { PlayerGame } from "@/lib/game/view";

type Phase = "loading" | "opening" | "board" | "lock" | "ending";
type Ending = { treasure: string; reveal: string; epilogue: string; hosted: boolean; state: Board };

const TYPE_LABEL: Record<string, string> = {
  "riddle-hunt": "Riddle",
  "observation-code": "Look closely",
  cipher: "Code",
  logic: "Brain teaser",
  "picture-fragment": "Torn picture",
};

export default function Play({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [player] = useState(() => (typeof window === "undefined" ? "" : playerId()));
  const [game, setGame] = useState<PlayerGame | null>(null);
  // Remote players are in someone else's room: they find things by tapping the photos.
  const [remote, setRemote] = useState(false);
  useEffect(() => setRemote(new URLSearchParams(window.location.search).has("remote")), []);
  const [board, setBoard] = useState<Board | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [openStation, setOpenStation] = useState<string | null>(null);
  const [code, setCode] = useState<number[]>([]);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [ending, setEnding] = useState<Ending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      // Play always uses the player's view, even on the host's device, so answers never sit in the page.
      const g = await fetchGame<PlayerGame>(id, { asPlayer: true });
      if (!g.plan) throw new Error("This game is still being built. Open it again in a minute.");
      document.documentElement.dataset.theme = g.theme;
      const res = await fetch(`/api/games/${id}/play/state?player=${player}`, { cache: "no-store" });
      const b = (await res.json()) as Board & { error?: string };
      if (!res.ok) throw new Error(b.error ?? "Could not load your progress.");
      setGame(g);
      setBoard(b);
      setCode(Array(g.plan.stations.length).fill(0));
      const seen = (() => {
        try {
          return localStorage.getItem(`roomscape:opened:${id}`) === "1";
        } catch {
          return false;
        }
      })();
      setPhase(seen || b.stations.some((s) => s.solved) ? "board" : "opening");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This game could not be loaded.");
    }
  }, [id, player]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (phase !== "board" && phase !== "lock") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const plan = game?.plan;
  const elapsed = board ? Math.max(0, ((board.finishedAt ? Date.parse(board.finishedAt) : now) - Date.parse(board.startedAt)) / 1000) : 0;
  const clock = `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`;
  const sceneUrl = plan?.scene ?? game?.room.frames[plan?.sceneFrame ?? 0]?.url;

  const lockedReason = useMemo(() => {
    if (!plan) return {} as Record<string, string>;
    const out: Record<string, string> = {};
    for (const s of plan.stations) {
      if (!s.after.length) continue;
      const names = s.after.map((a) => plan.stations.findIndex((x) => x.id === a) + 1);
      out[s.id] = names.length > 1 ? `Opens after clues ${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : `Opens after clue ${names[0]}`;
    }
    return out;
  }, [plan]);

  const begin = () => {
    try {
      localStorage.setItem(`roomscape:opened:${id}`, "1");
    } catch {
      /* fine */
    }
    cue("open");
    setPhase("board");
  };

  const tryLock = async () => {
    setLockMessage(null);
    const r = await postJSON<{ open: boolean; message?: string } & Partial<Ending>>(`/api/games/${id}/play/unlock`, {
      player,
      code: code.join(""),
    });
    if (!r.open) {
      cue("wrong");
      setLockMessage(r.message ?? "Not yet.");
      return;
    }
    cue("unlock");
    setEnding(r as Ending);
    setBoard(r.state!);
    setTimeout(() => setPhase("ending"), 1100);
  };

  if (error)
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
        <h1 className="font-display text-3xl">This case won’t open</h1>
        <p className="text-text-soft">{error}</p>
        <Link href="/" className="text-lantern underline underline-offset-4">
          Back to the start
        </Link>
      </main>
    );

  if (!game || !plan || !board) return <main className="min-h-dvh" aria-busy />;

  const pad = {
    paddingTop: "max(1rem, env(safe-area-inset-top))",
    paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
    paddingRight: "max(1.25rem, env(safe-area-inset-right))",
  };

  return (
    <>
      {phase === "opening" ? (
        <main className="relative mx-auto flex min-h-dvh max-w-md flex-col">
          <div className="relative aspect-[4/5] w-full overflow-hidden">
            {sceneUrl ? (
              <motion.img
                src={sceneUrl}
                alt="Your room in the story"
                className="absolute inset-0 h-full w-full object-cover"
                initial={{ scale: 1.12 }}
                animate={{ scale: 1 }}
                transition={{ duration: 6, ease: "easeOut" }}
              />
            ) : null}
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-night to-transparent" />
          </div>
          <div className="-mt-20 flex flex-col gap-5 pb-10" style={pad}>
            <motion.h1
              className="relative font-display text-[2.6rem] leading-[1.02]"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.9 }}
            >
              {plan.title}
            </motion.h1>
            <motion.p className="text-lg leading-relaxed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 1 }}>
              {plan.intro}
            </motion.p>
            <motion.p className="text-text-soft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}>
              {plan.stations.length} clues are hidden in this room. Each one you solve gives you a digit. Put them together to open the final lock.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 }}>
              <Button onClick={begin} className="min-h-14 w-full text-lg">
                Start the hunt
              </Button>
            </motion.div>
          </div>
        </main>
      ) : null}

      {phase === "board" || phase === "lock" ? (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 pb-10" style={pad}>
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-text-soft">The case board</p>
              <h1 className="font-display text-[1.8rem] leading-tight">{plan.title}</h1>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="font-mono text-xl tabular-nums">{clock}</span>
              <span className="text-xs text-text-soft">
                {board.hints} hint{board.hints === 1 ? "" : "s"} used
              </span>
            </div>
          </header>

          <section aria-label="Digits for the final lock" className="flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              {board.stations.map((s, i) => (
                <motion.div
                  key={s.id}
                  layout
                  className={clsx(
                    "grid h-14 flex-1 place-items-center rounded-2xl border-2 font-mono text-2xl font-bold",
                    s.solved ? "border-lantern bg-night-raised text-lantern" : "border-dashed border-ink-line text-text-soft",
                  )}
                  aria-label={s.solved ? `Digit ${i + 1}: ${s.digit}` : `Digit ${i + 1}: not found yet`}
                >
                  {s.solved ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 16 }}>
                      {s.digit}
                    </motion.span>
                  ) : (
                    i + 1
                  )}
                </motion.div>
              ))}
            </div>
          </section>

          <ol className="flex flex-col gap-3">
            {plan.stations.map((s, i) => {
              const b = board.stations[i];
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!b.open}
                    onClick={() => {
                      cue("tap");
                      setOpenStation(s.id);
                    }}
                    className={clsx(
                      "flex w-full items-center gap-4 rounded-3xl border p-3 text-left transition-colors",
                      b.solved ? "border-tide/50 bg-night-raised/60" : b.open ? "border-lantern/70 bg-night-raised" : "border-ink-line opacity-60",
                    )}
                  >
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-full border border-ink-line bg-night-deep">
                      {b.art ?? s.character.art ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.art ?? s.character.art} alt="" className={clsx("h-full w-full object-cover", !b.open && "grayscale")} />
                      ) : s.hiding ? (
                        <span className="grid h-full w-full place-items-center">
                          <span className="flex gap-2" aria-hidden>
                            <span className="h-1.5 w-2.5 rounded-full bg-lantern shadow-[0_0_6px_var(--lantern)]" />
                            <span className="h-1.5 w-2.5 rounded-full bg-lantern shadow-[0_0_6px_var(--lantern)]" />
                          </span>
                        </span>
                      ) : (
                        <span className="grid h-full w-full place-items-center font-display text-xl text-lantern">{i + 1}</span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-xs text-text-soft">
                        Clue {i + 1}: {TYPE_LABEL[s.type]}
                      </span>
                      <span className="truncate font-display text-lg">{s.title}</span>
                      <span className={clsx("text-sm", b.solved ? "text-tide" : b.open ? "text-lantern" : "text-text-soft")}>
                        {b.solved ? `Solved: digit ${b.digit}` : b.open ? (s.hiding ? `${s.character.name} is hiding somewhere` : `${s.character.name} is waiting`) : lockedReason[s.id]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <section className="flex flex-col gap-3 rounded-3xl border border-ink-line bg-night-deep/60 p-5">
            <h2 className="font-display text-xl">The final lock</h2>
            {board.allSolved ? (
              phase === "lock" ? (
                <div className="relative flex flex-col items-center gap-4">
                  {ending ? <UnlockBurst /> : null}
                  <CodeLock value={code} onChange={setCode} unlocked={Boolean(ending)} label="Final lock" />
                  {lockMessage ? <p className="text-center text-sm text-danger">{lockMessage}</p> : null}
                  <Button onClick={tryLock} disabled={Boolean(ending)} className="min-h-14 w-full text-lg">
                    Open the lock
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-text-soft">You have every digit. Enter them in order, clue 1 first.</p>
                  <Button onClick={() => setPhase("lock")} className="min-h-14 w-full text-lg">
                    Try the final lock
                  </Button>
                </>
              )
            ) : (
              <p className="text-text-soft">
                Solve every clue to collect all {plan.stations.length} digits. {board.stations.filter((s) => s.solved).length} found so far.
              </p>
            )}
          </section>
        </main>
      ) : null}

      {phase === "ending" && ending ? (
        <main className="relative mx-auto flex min-h-dvh max-w-md flex-col">
          <div className="relative aspect-[4/5] w-full overflow-hidden">
            {sceneUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sceneUrl} alt="Your room in the story" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <UnlockBurst />
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-night to-transparent" />
          </div>
          <div className="-mt-20 flex flex-col gap-5 pb-10" style={pad}>
            <motion.h1 className="relative font-display text-[2.6rem] leading-[1.02]" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              The lock opens
            </motion.h1>
            <motion.div initial={{ opacity: 0, y: 16, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: -1 }} transition={{ delay: 0.6 }}>
              <PaperCard>
                <p className="text-sm font-semibold">{ending.hosted ? "Your gift is waiting" : "You found " + ending.treasure}</p>
                <p className="mt-1 font-display text-[1.35rem] leading-snug">{ending.reveal}</p>
              </PaperCard>
            </motion.div>
            <motion.p className="text-lg leading-relaxed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
              {ending.epilogue}
            </motion.p>
            <motion.div
              className="grid grid-cols-3 gap-2 rounded-3xl border border-ink-line bg-night-raised p-4 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.6 }}
            >
              <Stat label="Time" value={clock} />
              <Stat label="Hints" value={String(ending.state.hints)} />
              <div className="flex flex-col items-center gap-1">
                <Stars n={ending.state.stars ?? 1} />
                <span className="text-xs text-text-soft">Rating</span>
              </div>
            </motion.div>
            {!ending.hosted ? (
              <Button variant="quiet" onClick={() => shareRoom(id, plan.title)}>
                Send this room to a friend
              </Button>
            ) : null}
            {game.makingOf ? <MakingOf steps={game.makingOf} /> : null}
            <Link href="/" className="text-center text-text-soft underline decoration-ink-line underline-offset-4">
              Make a hunt for another room
            </Link>
          </div>
        </main>
      ) : null}

      <AnimatePresence>
        {openStation && plan ? (
          <StationScreen
            key={openStation}
            gameId={id}
            game={game}
            station={plan.stations.find((s) => s.id === openStation)!}
            board={board.stations.find((s) => s.id === openStation)!}
            index={plan.stations.findIndex((s) => s.id === openStation)}
            player={player}
            remote={remote}
            onBoard={setBoard}
            onClose={() => setOpenStation(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

async function shareRoom(id: string, title: string) {
  const url = `${window.location.origin}/game/${id}/play?remote=1`;
  try {
    if (navigator.share) await navigator.share({ title, text: "I solved the mystery in my room. Can you?", url });
    else await navigator.clipboard.writeText(url);
  } catch {
    /* share sheet closed */
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-2xl tabular-nums">{value}</span>
      <span className="text-xs text-text-soft">{label}</span>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <svg key={i} width="22" height="22" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1 6.1 20.3l1.3-6.5L2.5 9.3l6.6-.8z"
            fill={i <= n ? "var(--lantern)" : "none"}
            stroke="var(--lantern)"
            strokeWidth="1.5"
          />
        </svg>
      ))}
    </span>
  );
}
