import type { Game } from "@/lib/game/schema";

/** True when the request carries this game's host key. */
export function isHost(req: Request, game: Game): boolean {
  const key = req.headers.get("x-host-key");
  return Boolean(key && game.hostKey && key === game.hostKey);
}
