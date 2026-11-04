import { NextResponse } from "next/server";
import { z } from "zod";
import { logTrace, route } from "@/lib/api";
import { progressFor } from "@/lib/game/play";
import { transcribe } from "@/lib/models";
import { talkInCharacter } from "@/lib/pipeline/talk";
import { GameNotFound, loadGame } from "@/lib/store";

export const maxDuration = 60;

const Meta = z.object({
  player: z.string().min(4),
  stationId: z.string(),
  text: z.string().max(300).optional(),
  history: z.array(z.object({ role: z.enum(["player", "character"]), text: z.string().max(400) })).max(12).default([]),
});

/**
 * Talk to a clue's character. Speech is heard by Muse Voice Transcribe, and
 * Muse Spark Open answers in character without giving the answer away.
 */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const form = await req.formData();
  const meta = Meta.parse(JSON.parse(String(form.get("meta") ?? "{}")));
  const audio = form.get("audio");

  const game = await loadGame(id);
  if (!game?.plan) throw new GameNotFound(id);
  const station = game.plan.stations.find((s) => s.id === meta.stationId);
  if (!station) return NextResponse.json({ error: "No such clue." }, { status: 404 });

  let heard = meta.text?.trim() ?? "";
  if (!heard && audio instanceof Blob && audio.size > 1000) {
    const keywords = [...game.plan.stations.map((s) => s.character.name), ...game.room.objects.map((o) => o.name)];
    heard = await transcribe({ wav: audio, keywords, trace: logTrace });
  }
  if (!heard) return NextResponse.json({ heard: "", reply: "Sorry, I didn’t catch that. Hold the button and speak a little closer." });

  const p = progressFor(game, meta.player);
  const { reply, guarded } = await talkInCharacter({
    game,
    station,
    solved: Boolean(p.solved[station.id]),
    hintsShown: p.hints[station.id] ?? 0,
    history: meta.history,
    said: heard,
    trace: logTrace,
  });
  return NextResponse.json({ heard, reply, guarded });
});
