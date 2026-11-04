import type { Game } from "./schema";

export type MakingStep = { model: string; did: string };

/** A plain account of which Meta model did what for this game. Counts only, no secrets. */
export function makingOf(game: Game): MakingStep[] {
  const objects = game.room.objects.filter((o) => o.status !== "dropped");
  const outlined = objects.filter((o) => o.maskPath).length;
  const facts = objects.flatMap((o) => o.facts);
  const checked = facts.filter((f) => f.verified).length;
  const plan = game.plan;
  const steps: MakingStep[] = [
    { model: "Muse Spark 1.3", did: `Read ${game.room.frames.length} photos of the room and listed ${objects.length} objects with ${facts.length} details.` },
    {
      model: "SAM 3.1",
      did: outlined
        ? `Traced the exact outline of ${outlined} objects, so taps and photos can be checked${outlined < objects.length ? ` (${objects.length - outlined} use a box)` : ""}.`
        : "Looked for the exact outline of every object, so taps and photos can be checked.",
    },
    { model: "Muse Spark 1.3", did: `Looked at every close-up a second time. ${checked} details matched both times and are used in puzzles.` },
  ];
  if (!plan) return steps;
  const blind = plan.stations.filter((s) => s.check === "solved-blind").length;
  const coded = plan.stations.filter((s) => s.check === "code").length;
  const art = (plan.scene ? 1 : 0) + plan.stations.filter((s) => s.character.art).length + plan.stations.filter((s) => s.image).length;
  steps.push(
    { model: plan.designedBy, did: `Wrote the story, ${plan.stations.length} characters and their clues.` },
    {
      model: "Muse Spark 1.3",
      did: `Played every riddle without the answers before you saw it: ${blind} solved blind${coded ? `, ${coded} proven by code` : ""}.`,
    },
  );
  if (art) steps.push({ model: "Muse Image 1.0", did: `Painted ${art} pictures from your own room: the scene, the characters and torn picture clues.` });
  steps.push(
    { model: "Muse Spark Open", did: "Plays each character when you talk to it, and judges photo answers." },
    { model: "Muse Voice Transcribe 1.0", did: "Hears what you say to the characters." },
  );
  return steps;
}
