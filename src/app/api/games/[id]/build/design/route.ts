import { NextResponse } from "next/server";
import { logTrace, route } from "@/lib/api";
import { designGame } from "@/lib/pipeline/design";
import { updateGame } from "@/lib/store";

export const maxDuration = 300;

/** Build step 1: Muse Wonder designs the game; code rules and a Muse Spark blind solve check it. */
export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const game = await updateGame(id, async (g) => {
    if (g.plan) return;
    g.stage = "building";
    const { plan, notes } = await designGame(g, logTrace);
    g.plan = plan;
    g.buildNotes = notes;
  });
  const plan = game.plan!;
  return NextResponse.json({
    title: plan.title,
    intro: plan.intro,
    designedBy: plan.designedBy,
    stations: plan.stations.map((s) => ({ id: s.id, type: s.type, title: s.title, character: s.character, check: s.check })),
    notes: game.buildNotes,
  });
});
