import { NextResponse } from "next/server";
import { z } from "zod";
import { logTrace, route } from "@/lib/api";
import { checkDetails } from "@/lib/pipeline/scan";
import { updateGame } from "@/lib/store";

export const maxDuration = 60;

const Body = z.object({
  crops: z.array(z.object({ objectId: z.string(), dataUrl: z.string().startsWith("data:image/") })).max(8),
  last: z.boolean().default(false),
});

/** Scan step 3: Muse Spark 1.3 re-reads each detail from a close-up crop. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = Body.parse(await req.json());
  const game = await updateGame(id, async (g) => {
    await checkDetails(g, body.crops, logTrace);
    if (body.last) g.stage = "scanned";
  });
  return NextResponse.json({ objects: game.room.objects });
});
