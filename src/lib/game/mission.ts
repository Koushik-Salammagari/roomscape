import type { Game } from "./schema";

/** The one-line goal shown before play, in each story's own terms. */
export function missionLine(theme: Game["theme"], count: number, hosted: boolean): string {
  const prize = hosted ? "your gift" : "the treasure";
  if (theme === "heist")
    return `${count} suspects are hiding in this room’s furniture. Each one knows a digit of the vault code. Find them, get them talking, and crack the vault${hosted ? " to find your gift" : ""}.`;
  if (theme === "haunted")
    return `${count} spirits are trapped in the things around you. Find each one, talk to it, and set it free. Every spirit you free gives a digit of the final lock${hosted ? ", and the last one shows you where your gift is" : ""}.`;
  return `${count} clues stand between you and ${prize}. Each one lives in something in this room. Find it, talk to it, and it gives you one digit of the final lock.`;
}
