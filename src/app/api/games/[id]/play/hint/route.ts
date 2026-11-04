import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { boardState, progressFor } from "@/lib/game/play";
import { updateGame } from "@/lib/store";

const Body = z.object({ player: z.string().min(4), stationId: z.string() });

/** Shows the next hint for a station: nudge, then pointer, then reveal. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = Body.parse(await req.json());
  let hint = "";
  let level = 0;
  let state;
  await updateGame(id, (g) => {
    const station = g.plan?.stations.find((s) => s.id === body.stationId);
    if (!station) throw new Error("No such clue.");
    const p = progressFor(g, body.player);
    level = Math.min((p.hints[station.id] ?? 0) + 1, 3);
    p.hints[station.id] = level;
    hint = station.hints[level - 1];
    state = boardState(g, p);
  });
  return NextResponse.json({ hint, level, state });
});
