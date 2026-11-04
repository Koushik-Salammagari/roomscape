import { NextResponse } from "next/server";
import { z } from "zod";
import { logTrace, route } from "@/lib/api";
import { boardState, progressFor } from "@/lib/game/play";
import { isOpen } from "@/lib/game/progress";
import { judge, type Verdict } from "@/lib/pipeline/judge";
import { GameNotFound, loadGame, updateGame } from "@/lib/store";

export const maxDuration = 60;

const Body = z.object({
  player: z.string().min(4),
  stationId: z.string(),
  attempt: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("text"), value: z.string().max(80) }),
    z.object({ kind: z.literal("tap"), frame: z.number().int(), x: z.number(), y: z.number() }),
    z.object({ kind: z.literal("photo"), dataUrl: z.string().startsWith("data:image/"), width: z.number(), height: z.number() }),
  ]),
});

/** Checks an answer. The model calls run before the game is locked for saving, so slow checks never block other players. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = Body.parse(await req.json());
  const game = await loadGame(id);
  if (!game?.plan) throw new GameNotFound(id);
  const station = game.plan.stations.find((s) => s.id === body.stationId);
  if (!station) return NextResponse.json({ error: "No such clue." }, { status: 404 });
  if (!isOpen(game.plan, progressFor(game, body.player), station.id)) {
    return NextResponse.json({ error: "This clue isn’t open yet." }, { status: 409 });
  }

  const verdict: Verdict = await judge(game, station, body.attempt, logTrace);

  let state;
  await updateGame(id, (g) => {
    const p = progressFor(g, body.player);
    if (verdict.correct && !p.solved[station.id]) p.solved[station.id] = { at: new Date().toISOString(), hints: p.hints[station.id] ?? 0 };
    if (!verdict.correct) p.wrong += 1;
    state = boardState(g, p);
  });
  return NextResponse.json({
    ...verdict,
    digit: verdict.correct ? station.digit : undefined,
    art: verdict.correct ? station.character.art : undefined,
    state,
  });
});
