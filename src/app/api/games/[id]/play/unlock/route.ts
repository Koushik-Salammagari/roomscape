import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { boardState, progressFor } from "@/lib/game/play";
import { updateGame } from "@/lib/store";

const Body = z.object({ player: z.string().min(4), code: z.string().regex(/^\d{1,8}$/) });

/** The final lock. Only the right code reveals the ending. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = Body.parse(await req.json());
  let result: Record<string, unknown> = {};
  await updateGame(id, (g) => {
    const plan = g.plan!;
    const p = progressFor(g, body.player);
    if (body.code !== plan.finalCode) {
      p.wrong += 1;
      result = { open: false, message: "The lock doesn’t budge. Check the order of your digits." };
      return;
    }
    p.finishedAt ??= new Date().toISOString();
    result = {
      open: true,
      treasure: plan.treasure,
      reveal: plan.reveal,
      epilogue: plan.epilogue,
      hosted: g.mode === "host",
      state: boardState(g, p),
    };
  });
  return NextResponse.json(result);
});
