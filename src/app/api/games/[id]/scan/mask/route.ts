import { logTrace, route } from "@/lib/api";
import { maskObject } from "@/lib/pipeline/scan";
import { GameNotFound, loadGame, saveGame } from "@/lib/store";
import type { RoomObject } from "@/lib/game/schema";

export const maxDuration = 300;

/** Meta rate-limits parallel SAM calls on new accounts (reported as 404), so calls go one or two at a time. */
const CONCURRENCY = Number(process.env.SAM_CONCURRENCY ?? 1);

/**
 * Scan step 2: SAM 3.1 masks every object, a few at a time. Each result is
 * streamed back as one JSON line the moment it is ready, so outlines appear
 * on the phone one by one.
 */
export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const game = await loadGame(id);
  if (!game) throw new GameNotFound(id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const results = new Map<string, RoomObject>();
      const queue = [...game.room.objects];
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const masked = await maskObject(game, next, logTrace);
          results.set(masked.id, masked);
          controller.enqueue(encoder.encode(`${JSON.stringify({ object: masked })}\n`));
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      game.room.objects = game.room.objects.map((o) => results.get(o.id) ?? o);
      await saveGame(game);
      controller.enqueue(encoder.encode(`${JSON.stringify({ done: true })}\n`));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
});
