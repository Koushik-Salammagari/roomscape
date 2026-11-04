import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { isHost } from "@/lib/host";
import { HostSchema } from "@/lib/game/plan";
import { GameNotFound, loadGame, saveGame } from "@/lib/store";

/** Saves the host's choices: the gift spot, pinned and blocked objects, and personal touches. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const game = await loadGame(id);
  if (!game) throw new GameNotFound(id);
  if (!isHost(req, game)) return NextResponse.json({ error: "Only the device that scanned this room can set up the hunt." }, { status: 403 });
  const host = HostSchema.parse(await req.json());
  const known = new Set(game.room.objects.map((o) => o.id));
  if (host.prizeObjectId && !known.has(host.prizeObjectId)) return NextResponse.json({ error: "Pick the gift spot from the outlined objects." }, { status: 400 });
  game.host = {
    ...host,
    pinned: host.pinned.filter((p) => known.has(p) && p !== host.prizeObjectId).slice(0, 3),
    blocked: host.blocked.filter((b) => known.has(b)),
  };
  game.plan = undefined; // a new setup means a fresh design
  game.stage = "setup";
  await saveGame(game);
  return NextResponse.json({ ok: true });
});
