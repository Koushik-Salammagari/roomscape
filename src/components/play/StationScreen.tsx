"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { PaperCard } from "@/components/ui/PaperCard";
import { Character } from "./Character";
import { CameraFinder, type FindResult, type Shot } from "./CameraFinder";
import { RoomTapper } from "./RoomTapper";
import { UnlockBurst } from "./UnlockBurst";
import { TalkBar } from "./TalkBar";
import { LiveWindow } from "./LiveWindow";
import { TalkingLens } from "./TalkingLens";
import { postJSON } from "@/lib/client/game";
import { cue } from "@/lib/client/player";
import type { PlayerGame } from "@/lib/game/view";

export type BoardStation = { id: string; open: boolean; solved: boolean; digit?: number; art?: string; hintsShown: number; shownHints: string[] };
export type Board = { startedAt: string; finishedAt?: string; stations: BoardStation[]; allSolved: boolean; hints: number; stars?: number };
type PlanStation = NonNullable<PlayerGame["plan"]>["stations"][number];
type Attempt =
  | { kind: "text"; value: string }
  | { kind: "tap"; frame: number; x: number; y: number }
  | { kind: "photo"; dataUrl: string; width: number; height: number };
type AnswerReply = FindResult & { digit?: number; art?: string; state: Board };

type Props = {
  gameId: string;
  game: PlayerGame;
  station: PlanStation;
  board: BoardStation;
  index: number;
  player: string;
  /** Playing someone else's room: tap the photos instead of using the camera. */
  remote?: boolean;
  /** Where to go after this clue, said by the character when it is solved. */
  nextLine?: string;
  onBoard: (b: Board) => void;
  onClose: () => void;
};

const TYPE_LABEL: Record<string, string> = {
  "riddle-hunt": "Riddle",
  "observation-code": "Look closely",
  cipher: "Code",
  logic: "Brain teaser",
  "picture-fragment": "Torn picture",
};

export function StationScreen({ gameId, game, station, board, index, player, remote = false, nextLine = "", onBoard, onClose }: Props) {
  const [line, setLine] = useState(station.character.greeting);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [solvedDigit, setSolvedDigit] = useState<number | undefined>(board.solved ? board.digit : undefined);
  const [camera, setCamera] = useState(false);
  const [tapping, setTapping] = useState(remote);
  const [hints, setHints] = useState<string[]>(board.shownHints);
  const shake = useAnimationControls();
  const foundDigit = useRef<number | undefined>(undefined);
  const [art, setArt] = useState<string | undefined>(board.art ?? station.character.art);
  const object = station.objectId ? game.room.objects.find((o) => o.id === station.objectId) : undefined;
  const crop = object?.crop;
  const hiding = Boolean(station.hiding) && solvedDigit === undefined;

  // Clues with a named object are met in person first: walk up to it, point the camera, and it wakes up.
  const meetable = !station.hiding && Boolean(object);
  const metKey = `roomscape:met:${gameId}:${station.id}`;
  const [met, setMet] = useState<boolean>(() => {
    if (!meetable || board.solved) return true;
    try {
      return localStorage.getItem(metKey) === "1";
    } catch {
      return false;
    }
  });
  const [meeting, setMeeting] = useState(false);
  const [liveCamera, setLiveCamera] = useState(false);
  // The talking lens: the real object, alive in the live camera.
  const [lens, setLens] = useState(() => meetable && met && !remote && !board.solved);
  const [speaking, setSpeaking] = useState(false);
  const verifyShot = useCallback(
    (shot: Shot) => postJSON<FindResult>(`/api/games/${gameId}/play/meet`, { player, stationId: station.id, attempt: { kind: "photo", ...shot } }),
    [gameId, player, station.id],
  );
  const firstLine = station.prompt.split("\n").filter(Boolean)[0] ?? "";
  const wake = (byCamera: boolean) => {
    try {
      localStorage.setItem(metKey, "1");
    } catch {
      /* fine */
    }
    cue("unlock");
    setMet(true);
    setLiveCamera(byCamera);
    if (!byCamera) setLens(false);
    setLine(`${station.character.greeting} ${firstLine}`);
  };
  const wakeByCamera = useCallback(() => wake(true), []); // eslint-disable-line react-hooks/exhaustive-deps
  const meetTap = async (t: { frame: number; x: number; y: number }) => {
    setBusy(true);
    try {
      const r = await postJSON<FindResult>(`/api/games/${gameId}/play/meet`, { player, stationId: station.id, attempt: { kind: "tap", ...t } });
      if (r.correct) wake(false);
      else {
        cue("wrong");
        setLine(r.message ?? `That’s not the ${object?.name}.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const send = async (attempt: Attempt): Promise<AnswerReply> => {
    const reply = await postJSON<AnswerReply>(`/api/games/${gameId}/play/answer`, { player, stationId: station.id, attempt });
    onBoard(reply.state);
    return reply;
  };

  const handle = (reply: AnswerReply) => {
    if (reply.correct) {
      cue("unlock");
      if (reply.art) setArt(reply.art);
      setSolvedDigit(reply.digit);
      setLine(`${station.hiding ? "You found me!" : "You solved it!"} Here’s your digit for the final lock. ${nextLine}`.trim());
    } else {
      cue("wrong");
      setLine(reply.message ?? "Not quite.");
      shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.4 } });
    }
  };

  const submit = async (attempt: Attempt) => {
    setBusy(true);
    try {
      handle(await send(attempt));
    } catch (e) {
      setLine(e instanceof Error ? e.message : "That check failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const hint = async () => {
    setBusy(true);
    try {
      const r = await postJSON<{ hint: string; level: number; state: Board }>(`/api/games/${gameId}/play/hint`, { player, stationId: station.id });
      setHints((h) => [...h.slice(0, r.level - 1), r.hint]);
      setLine(r.hint);
      onBoard(r.state);
    } finally {
      setBusy(false);
    }
  };

  const isHunt = station.type === "riddle-hunt" || station.type === "picture-fragment";

  return (
    <motion.div
      className="fixed inset-0 z-40 overflow-y-auto bg-night"
      style={{ backgroundImage: "var(--wash)" }}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 34 }}
    >
      <div
        className="mx-auto flex min-h-full max-w-md flex-col gap-6 pb-10"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
          paddingRight: "max(1.25rem, env(safe-area-inset-right))",
        }}
      >
        <header className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="-ml-2 rounded-xl px-2 py-2 text-sm text-text-soft">
            Case board
          </button>
          <span className="text-sm text-text-soft">
            Clue {index + 1} of {game.plan!.stations.length}: {TYPE_LABEL[station.type]}
          </span>
        </header>

        <h1 className="font-display text-[2rem] leading-tight">{station.title}</h1>

        {lens && object ? (
          <div className="flex flex-col gap-4">
            <TalkingLens
              gameId={gameId}
              stationId={station.id}
              objectName={object.name}
              onVerify={verifyShot}
              onAwake={wakeByCamera}
              awake={met}
              speaking={speaking}
            />
            {met ? (
              <>
                <Character
                  name={station.character.name}
                  art={art}
                  crop={crop}
                  voice={station.character.voice}
                  line={line}
                  thinking={thinking}
                  size="sm"
                  onSpeaking={setSpeaking}
                />
                <TalkBar gameId={gameId} stationId={station.id} player={player} name={station.character.name} onReply={setLine} onThinking={setThinking} />
              </>
            ) : (
              <Button variant="ghost" onClick={() => wake(false)} className="self-center">
                I can’t reach it, talk here
              </Button>
            )}
          </div>
        ) : !met && object ? (
          <div className="flex flex-col gap-5">
            <PaperCard tilt={-0.8}>
              <p className="text-sm font-semibold">Your next clue is waiting at</p>
              <div className="mt-3 flex items-center gap-4">
                {crop ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={crop} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />
                ) : null}
                <p className="font-display text-[1.6rem] leading-tight">the {object.name}</p>
              </div>
              <p className="mt-3 text-[0.95rem]">
                {remote
                  ? `Find it in the room photos and tap it. ${station.character.name} will wake up and talk to you.`
                  : `Walk over to it and point your camera at it. ${station.character.name} lives there and will wake up and talk to you.`}
              </p>
            </PaperCard>
            {remote ? (
              <>
                <RoomTapper frames={game.room.frames} busy={busy} onTap={meetTap} />
                {line !== station.character.greeting ? <p className="text-sm text-text-soft">{line}</p> : null}
              </>
            ) : (
              <>
                <Button onClick={() => setLens(true)} className="min-h-14 w-full text-lg">
                  I’m here, open the camera
                </Button>
                <Button variant="ghost" onClick={() => wake(false)} className="self-center">
                  I can’t reach it, talk here
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {meetable && solvedDigit === undefined ? (
              <LiveWindow camera={liveCamera} still={crop ?? game.room.frames[object!.frame]?.url} name={station.character.name} art={art} speaking={thinking} />
            ) : null}
            <Character
              name={station.character.name}
              art={art}
              crop={crop}
              hiding={hiding}
              voice={station.character.voice}
              line={line}
              thinking={thinking}
              size={meetable && solvedDigit === undefined ? "sm" : "lg"}
            />
            <TalkBar gameId={gameId} stationId={station.id} player={player} name={station.character.name} onReply={setLine} onThinking={setThinking} />
          </div>
        )}

        {!met ? null : solvedDigit !== undefined ? (
          <div className="relative flex flex-col items-center gap-4 py-8">
            <UnlockBurst />
            <motion.div
              className="grid size-28 place-items-center rounded-3xl border-2 border-lantern bg-night-raised font-mono text-6xl font-bold text-lantern"
              initial={{ scale: 0.3, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 14 }}
            >
              {solvedDigit}
            </motion.div>
            <p className="text-center text-text-soft">
              Digit {index + 1} of the final lock. It’s saved on your case board.
            </p>
            <Button onClick={onClose} className="min-h-14 w-full text-lg">
              Back to the case board
            </Button>
          </div>
        ) : (
          <motion.div animate={shake} className="flex flex-col gap-5">
            {station.type === "picture-fragment" && station.image ? (
              <PaperCard tilt={-1.5} className="p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={station.image} alt="A torn picture of part of the room" className="w-full rounded-sm" />
                <p className="mt-3 text-[0.95rem] leading-relaxed">{station.prompt}</p>
              </PaperCard>
            ) : (
              <PaperCard tilt={-0.8}>
                <PromptText text={station.prompt} />
              </PaperCard>
            )}

            {station.type === "logic" ? (
              <div className="flex flex-col gap-2">
                {(station.statements ?? []).map((s) => (
                  <p key={s} className="rounded-2xl border border-ink-line bg-night-raised px-4 py-3 text-[0.95rem]">
                    {s}
                  </p>
                ))}
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(station.options ?? []).map((o) => (
                    <Button key={o} variant="quiet" disabled={busy} onClick={() => submit({ kind: "text", value: o })}>
                      {o}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {station.type === "observation-code" ? <NumberPad busy={busy} onSubmit={(v) => submit({ kind: "text", value: v })} /> : null}
            {station.type === "cipher" ? <WordEntry busy={busy} onSubmit={(v) => submit({ kind: "text", value: v })} /> : null}

            {isHunt ? (
              <div className="flex flex-col gap-3">
                {remote ? (
                  <p className="text-sm text-text-soft">Tap the thing the clue describes in one of the room photos.</p>
                ) : (
                  <>
                    <Button onClick={() => setCamera(true)} className="min-h-14 w-full text-lg">
                      Find it with the camera
                    </Button>
                    <Button variant="quiet" onClick={() => setTapping((t) => !t)}>
                      {tapping ? "Hide the room photos" : "Tap it in the room photos"}
                    </Button>
                  </>
                )}
                {tapping ? (
                  <RoomTapper frames={game.room.frames} busy={busy} onTap={(t) => submit({ kind: "tap", ...t })} />
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 border-t border-ink-line pt-4">
              <Button variant="ghost" disabled={busy || hints.length >= 3} onClick={hint} className="self-start">
                {hints.length >= 3 ? "No hints left" : `Ask ${station.character.name} for a hint (${hints.length + 1} of 3)`}
              </Button>
              {hints.length ? (
                <ol className="flex flex-col gap-1.5 text-sm text-text-soft">
                  {hints.map((h, i) => (
                    <li key={i}>
                      <span className="font-semibold text-text">{["Nudge", "Pointer", "Answer"][i]}: </span>
                      {h}
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {meeting && object ? (
          <CameraFinder
            key="meet"
            prompt={`Point at the ${object.name}`}
            foundText={`${station.character.name} is waking up…`}
            onClose={() => setMeeting(false)}
            onShot={(shot: Shot) => postJSON<FindResult>(`/api/games/${gameId}/play/meet`, { player, stationId: station.id, attempt: { kind: "photo", ...shot } })}
            onFound={() => {
              setMeeting(false);
              wake(true);
            }}
          />
        ) : null}
        {camera ? (
          <CameraFinder
            onClose={() => setCamera(false)}
            onShot={async (shot: Shot) => {
              const reply = await send({ kind: "photo", ...shot });
              if (reply.correct) {
                foundDigit.current = reply.digit;
                if (reply.art) setArt(reply.art);
              }
              else cue("wrong");
              return reply;
            }}
            onFound={() => {
              setCamera(false);
              cue("unlock");
              setSolvedDigit(foundDigit.current);
              setLine(`You found me! Here’s your digit for the final lock. ${nextLine}`.trim());
            }}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

/** Renders a prompt, setting the cipher's coded word apart in big monospaced letters. */
function PromptText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3">
      {text.split("\n").filter(Boolean).map((p, i) => {
        const coded = p.match(/^The coded word: (.+)$/);
        if (coded)
          return (
            <p key={i} className="text-center font-mono text-3xl font-bold tracking-[0.25em]">
              {coded[1]}
            </p>
          );
        return (
          <p key={i} className="font-display text-[1.15rem] leading-snug">
            {p}
          </p>
        );
      })}
    </div>
  );
}

function NumberPad({ busy, onSubmit }: { busy: boolean; onSubmit: (v: string) => void }) {
  const [value, setValue] = useState("");
  const press = (d: string) => {
    cue("tap");
    setValue((v) => (v + d).slice(0, 3));
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid h-16 place-items-center rounded-2xl border border-ink-line bg-night-deep font-mono text-4xl font-semibold" aria-live="polite">
        {value || <span className="text-text-soft">?</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="h-14 rounded-2xl bg-night-raised font-mono text-2xl active:scale-95">
            {d}
          </button>
        ))}
        <button type="button" onClick={() => setValue((v) => v.slice(0, -1))} className="h-14 rounded-2xl bg-night-raised text-sm text-text-soft" aria-label="Delete">
          Delete
        </button>
        <button type="button" onClick={() => press("0")} className="h-14 rounded-2xl bg-night-raised font-mono text-2xl">
          0
        </button>
        <Button disabled={!value || busy} busy={busy} onClick={() => onSubmit(value)} className="h-14 min-h-0 px-0">
          Check
        </Button>
      </div>
    </div>
  );
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function WordEntry({ busy, onSubmit }: { busy: boolean; onSubmit: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex flex-wrap justify-center gap-1" aria-label="Alphabet with letter numbers">
        {ALPHABET.map((l, i) => (
          <span key={l} className="flex w-[2.05rem] flex-col items-center rounded-md bg-night-deep py-1">
            <span className="font-mono text-sm font-semibold">{l}</span>
            <span className="font-mono text-[0.6rem] text-text-soft">{i + 1}</span>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value);
        }}
      >
        <label htmlFor="cipher-answer" className="sr-only">
          The decoded word
        </label>
        <input
          id="cipher-answer"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="The decoded word"
          className={clsx(
            "min-h-14 min-w-0 flex-1 rounded-2xl border border-ink-line bg-night-deep px-4 font-mono text-xl tracking-widest",
            "placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:text-text-soft",
          )}
        />
        <Button type="submit" disabled={!value.trim() || busy} busy={busy} className="min-h-14">
          Check
        </Button>
      </form>
    </div>
  );
}
