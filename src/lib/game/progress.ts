import { z } from "zod";
import type { Plan } from "./plan";

export const PlayerProgressSchema = z.object({
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  /** stationId → when it was solved and how many hints were used. */
  solved: z.record(z.string(), z.object({ at: z.string(), hints: z.number() })).default({}),
  /** stationId → how many hints have been shown. */
  hints: z.record(z.string(), z.number()).default({}),
  wrong: z.number().default(0),
});
export type PlayerProgress = z.infer<typeof PlayerProgressSchema>;

export function newProgress(): PlayerProgress {
  return { startedAt: new Date().toISOString(), solved: {}, hints: {}, wrong: 0 };
}

/** A station is open once every station it waits for is solved. */
export function isOpen(plan: Pick<Plan, "stations">, progress: PlayerProgress, stationId: string): boolean {
  const station = plan.stations.find((s) => s.id === stationId);
  return Boolean(station && station.after.every((id) => progress.solved[id]));
}

export function totalHints(progress: PlayerProgress): number {
  return Object.values(progress.hints).reduce((a, b) => a + b, 0);
}

/** Three stars for a clean, quick solve; fewer as hints and time add up. */
export function starsFor(progress: PlayerProgress, stationCount: number): number {
  const hints = totalHints(progress);
  const minutes = ((progress.finishedAt ? Date.parse(progress.finishedAt) : Date.now()) - Date.parse(progress.startedAt)) / 60000;
  const par = stationCount * 4;
  if (hints <= 1 && minutes <= par) return 3;
  if (hints <= stationCount) return 2;
  return 1;
}
