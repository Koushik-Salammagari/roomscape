import { NextResponse } from "next/server";
import { z } from "zod";
import { logTrace, route } from "@/lib/api";
import { findObject } from "@/lib/pipeline/judge";
import { GameNotFound, loadGame } from "@/lib/store";

export const maxDuration = 60;

const Body = z.object({
  player: z.string().min(4),
  stationId: z.string(),
  attempt: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("tap"), frame: z.number().int(), x: z.number(), y: z.number() }),
    z.object({ kind: z.literal("photo"), dataUrl: z.string().startsWith("data:image/"), width: z.number(), height: z.number() }),
  ]),
});

/**
 * The player has walked up to a clue's object and pointed the camera at it.
 * SAM 3.1 finds it and Spark confirms it is the same thing, then the character wakes up.
 * Only for clues whose object is already named; a hunt's object is its answer.
 */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = Body.parse(await req.json());
  const game = await loadGame(id);
  if (!game?.plan) throw new GameNotFound(id);
  const station = game.plan.stations.find((s) => s.id === body.stationId);
  if (!station) return NextResponse.json({ error: "No such clue." }, { status: 404 });
  if (station.type === "riddle-hunt" || station.type === "picture-fragment") {
    return NextResponse.json({ error: "Solve the riddle to find this one." }, { status: 409 });
  }
  const target = game.room.objects.find((o) => o.id === station.objectId);
  if (!target) return NextResponse.json({ correct: true });
  const verdict = await findObject(game, target, body.attempt, logTrace);
  return NextResponse.json(
    verdict.correct ? verdict : { ...verdict, message: verdict.message?.replace("Read the clue again.", `Look for the ${target.name}.`) },
  );
});
