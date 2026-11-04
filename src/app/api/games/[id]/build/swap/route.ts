import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { isHost } from "@/lib/host";
import { swapStation } from "@/lib/pipeline/design";
import { GameNotFound, loadGame, saveGame } from "@/lib/store";

/** Host preview: swaps one clue for a tested backup on a different object. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const game = await loadGame(id);
  if (!game?.plan) throw new GameNotFound(id);
  if (!isHost(req, game)) return NextResponse.json({ error: "Only the host can change clues." }, { status: 403 });
  const { stationId } = z.object({ stationId: z.string() }).parse(await req.json());
  const station = swapStation(game, stationId);
  // A swapped picture fragment uses the new object's own close-up.
  if (station.type === "picture-fragment") {
    const o = game.room.objects.find((x) => x.id === station.objectId);
    station.image = o?.crop ?? game.room.frames[o?.frame ?? 0]?.url;
  }
  await saveGame(game);
  return NextResponse.json({ station });
});
