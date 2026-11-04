import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { GameNotFound, loadGame } from "@/lib/store";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const game = await loadGame(id);
  if (!game) throw new GameNotFound(id);
  return NextResponse.json(game);
});
