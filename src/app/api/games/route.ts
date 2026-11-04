import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { newId, saveGame } from "@/lib/store";
import type { Game } from "@/lib/game/schema";

const CreateGame = z.object({
  mode: z.enum(["host", "quick"]),
  theme: z.enum(["lost-treasure", "mystery", "heist", "haunted"]),
  difficulty: z.enum(["easy", "normal", "hard"]),
});

export const POST = route(async (req: Request) => {
  const body = CreateGame.parse(await req.json());
  const game: Game = {
    id: newId("g"),
    createdAt: new Date().toISOString(),
    ...body,
    stage: "scanning",
    room: { frames: [], objects: [], summary: "" },
    hostKey: newId("k"),
    buildNotes: [],
    progress: {},
  };
  await saveGame(game);
  return NextResponse.json({ id: game.id, hostKey: game.hostKey });
});
