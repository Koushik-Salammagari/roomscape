import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { boardState, progressFor } from "@/lib/game/play";
import { updateGame } from "@/lib/store";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const player = new URL(req.url).searchParams.get("player") ?? "";
  if (!player) return NextResponse.json({ error: "Missing player." }, { status: 400 });
  let state;
  await updateGame(id, (g) => {
    if (!g.plan) throw new Error("This game is still being built.");
    state = boardState(g, progressFor(g, player));
  });
  return NextResponse.json(state);
});
