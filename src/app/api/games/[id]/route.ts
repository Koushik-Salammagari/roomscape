import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { GameNotFound, loadGame } from "@/lib/store";
import { hostView, playerView } from "@/lib/game/view";

export const dynamic = "force-dynamic";

/** Players get an answer-free view; the device holding the host key gets everything. */
export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const game = await loadGame(id);
  if (!game) throw new GameNotFound(id);
  const key = req.headers.get("x-host-key");
  const isHost = Boolean(key && game.hostKey && key === game.hostKey);
  return NextResponse.json({ ...(isHost ? hostView(game) : playerView(game)), isHost });
});
