import { logTrace, route } from "@/lib/api";
import { paintGame } from "@/lib/pipeline/art";
import { GameNotFound, loadGame, saveGame } from "@/lib/store";

export const maxDuration = 300;

/**
 * Build step 2: Muse Image paints the scene, the characters and the picture
 * fragment. Each image is streamed back as one JSON line the moment it is ready.
 */
export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const game = await loadGame(id);
  if (!game) throw new GameNotFound(id);
  if (!game.plan) return Response.json({ error: "Design the game before painting it." }, { status: 409 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(msg)}\n`));
      const alreadyPainted = Boolean(game.plan!.scene);
      if (!alreadyPainted) await paintGame(game, (event) => send(event), logTrace);

      // A picture fragment always needs an image: fall back to the object's own close-up.
      for (const s of game.plan!.stations) {
        if (s.type === "picture-fragment" && !s.image) {
          const o = game.room.objects.find((x) => x.id === s.objectId);
          s.image = o?.crop ?? game.room.frames[o?.frame ?? 0]?.url;
        }
      }
      game.stage = "ready";
      await saveGame(game);
      send({ done: true, scene: game.plan!.scene, sceneFrame: game.plan!.sceneFrame });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
});
