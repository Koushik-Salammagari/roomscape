import type { Game } from "./schema";

/** The one-line goal shown before play, in each story's own terms. */
export function missionLine(theme: Game["theme"], count: number, hosted: boolean): string {
  const end = hosted ? "and the last one leads you to your gift" : "and the last one opens the final lock";
  if (theme === "mystery")
    return `Lord Ashby was poisoned at dinner. ${count} witnesses are hiding in the things in this room. Find each one, point your camera at it, and get it talking. Each witness sends you to the next, ${end}.`;
  if (theme === "heist")
    return `${count} suspects are hiding in this room’s furniture. Find each one, point your camera at it, and get it talking. Each suspect sends you to the next, ${end}.`;
  if (theme === "haunted")
    return `${count} spirits are trapped in the things around you. Find each one, talk to it, and set it free. Each spirit sends you to the next, ${end}.`;
  return `${count} clues stand between you and ${hosted ? "your gift" : "the treasure"}. Each one lives in something in this room. Find it, point your camera at it, and it talks to you. Each clue sends you to the next, ${end}.`;
}
