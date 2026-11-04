import { NextResponse } from "next/server";
import { logTrace, route } from "@/lib/api";
import { readRoom } from "@/lib/pipeline/scan";
import { updateGame } from "@/lib/store";

export const maxDuration = 90;

/** Scan step 1: Muse Spark 1.3 reads every frame and lists the room's objects. */
export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const game = await updateGame(id, async (g) => {
    if (!g.room.frames.length) throw new Error("Scan at least one frame first.");
    g.room.objects = await readRoom(g, logTrace);
  });
  return NextResponse.json({ summary: game.room.summary, objects: game.room.objects });
});
