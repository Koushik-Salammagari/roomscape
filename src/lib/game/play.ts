import type { Game } from "./schema";
import { isOpen, newProgress, starsFor, totalHints, type PlayerProgress } from "./progress";

/** Gets this player's run, starting one on first visit. */
export function progressFor(game: Game, playerId: string): PlayerProgress {
  game.progress[playerId] ??= newProgress();
  return game.progress[playerId];
}

/** Everything the board needs, with digits only for solved stations. */
export function boardState(game: Game, progress: PlayerProgress) {
  const plan = game.plan!;
  return {
    startedAt: progress.startedAt,
    finishedAt: progress.finishedAt,
    stations: plan.stations.map((s) => ({
      id: s.id,
      open: isOpen(plan, progress, s.id),
      solved: Boolean(progress.solved[s.id]),
      digit: progress.solved[s.id] ? s.digit : undefined,
      hintsShown: progress.hints[s.id] ?? 0,
      shownHints: s.hints.slice(0, progress.hints[s.id] ?? 0),
    })),
    allSolved: plan.stations.every((s) => progress.solved[s.id]),
    hints: totalHints(progress),
    stars: progress.finishedAt ? starsFor(progress, plan.stations.length) : undefined,
  };
}
