import { NextResponse } from "next/server";
import { z } from "zod";
import { logTrace, route } from "@/lib/api";
import { segmentImage } from "@/lib/models";
import { GameNotFound, loadGame } from "@/lib/store";

export const maxDuration = 20;

const Body = z.object({
  stationId: z.string(),
  dataUrl: z.string().startsWith("data:image/"),
  width: z.number(),
  height: z.number(),
});

/**
 * Live tracking for a talking object: SAM 3.1 finds the clue's object in a
 * small camera frame, about once a second, so it can move while it is in view
 * and fall quiet when the camera looks away. Hunts keep their object secret.
 */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = Body.parse(await req.json());
  const game = await loadGame(id);
  if (!game?.plan) throw new GameNotFound(id);
  const station = game.plan.stations.find((s) => s.id === body.stationId);
  if (!station || station.type === "riddle-hunt" || station.type === "picture-fragment") return NextResponse.json({ found: false });
  const target = game.room.objects.find((o) => o.id === station.objectId);
  if (!target) return NextResponse.json({ found: false });

  const sam = await segmentImage({
    imageUrl: body.dataUrl,
    concept: target.phrase || target.name,
    task: `Track the ${target.name}`,
    timeoutMs: 6_000,
    trace: (r) => {
      // Tracking runs every second; only failures go to the shared log.
      if (!r.ok) logTrace(r);
    },
    mockBoxes: [{ left: body.width * 0.3, top: body.height * 0.25, right: body.width * 0.7, bottom: body.height * 0.8 }],
  }).catch(() => null);

  const best = sam?.objects.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  if (!best || (best.confidence ?? 1) < 0.35) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, box: best.box, maskPath: best.maskPath, maskBounds: best.maskBounds, maskSize: best.maskSize });
});
