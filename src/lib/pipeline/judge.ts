import { z } from "zod";
import { askJSON, image, segmentImage, text, type Trace } from "@/lib/models";
import { toNumber } from "@/lib/game/facts";
import type { Game, RoomObject } from "@/lib/game/schema";
import type { Station } from "@/lib/game/plan";
import { modelReadableImage } from "@/lib/store";

export type Attempt =
  | { kind: "text"; value: string }
  | { kind: "tap"; frame: number; x: number; y: number }
  | { kind: "photo"; dataUrl: string; width: number; height: number };

export type Verdict = {
  correct: boolean;
  /** Shown to the player when wrong: a nudge, never the answer. */
  message?: string;
  /** For camera finds: SAM's outline of the object in the player's photo. */
  outline?: { box: RoomObject["box"]; maskPath?: string; maskBounds?: RoomObject["box"]; maskSize?: { width: number; height: number } };
};

const letters = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");

function closeEnough(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let diff = 0;
  for (let i = 0, j = 0; i < a.length || j < b.length; ) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    diff += 1;
    if (diff > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return true;
}

const SameObject = z.object({ same: z.boolean(), reason: z.string() });

/** Checks one attempt at a station. Codes and words are checked in code; camera finds use SAM 3.1 and Muse Spark Open. */
export async function judge(game: Game, station: Station, attempt: Attempt, trace?: Trace): Promise<Verdict> {
  const target = game.room.objects.find((o) => o.id === station.objectId);

  if (station.type === "observation-code") {
    const got = attempt.kind === "text" ? toNumber(attempt.value) : null;
    return got !== null && got === toNumber(station.answer)
      ? { correct: true }
      : { correct: false, message: "That number doesn’t open it. Count again, slowly." };
  }

  if (station.type === "cipher") {
    const got = attempt.kind === "text" ? letters(attempt.value) : "";
    // One slip of a letter still counts: the point is the decoding, not the spelling.
    return got.length >= 3 && closeEnough(got, station.answer)
      ? { correct: true }
      : { correct: false, message: "That isn’t the word. Check the shift, letter by letter." };
  }

  if (station.type === "logic") {
    const got = attempt.kind === "text" ? attempt.value.trim().toLowerCase() : "";
    return got === station.answer.trim().toLowerCase()
      ? { correct: true }
      : { correct: false, message: "If that were true, the story wouldn’t add up. Try each one in turn." };
  }

  // Hunts: riddle-hunt and picture-fragment.
  if (!target) return { correct: false, message: "This clue has lost its object. Use a hint to continue." };

  if (attempt.kind === "tap") {
    const pad = 0.08;
    const hit = game.room.objects.filter((o) => {
      if (o.frame !== attempt.frame) return false;
      const w = o.box.right - o.box.left;
      const h = o.box.bottom - o.box.top;
      return attempt.x >= o.box.left - w * pad && attempt.x <= o.box.right + w * pad && attempt.y >= o.box.top - h * pad && attempt.y <= o.box.bottom + h * pad;
    });
    if (hit.some((o) => o.id === target.id)) return { correct: true };
    // Spark lists one object per kind, so the same thing in another frame also counts by name.
    if (hit.some((o) => o.name.toLowerCase() === target.name.toLowerCase())) return { correct: true };
    return { correct: false, message: hit.length ? `Not the ${hit[0].name}. Read the clue again.` : "Nothing there. Tap right on an object." };
  }

  if (attempt.kind === "photo") {
    const reference = await modelReadableImage(target.crop ?? game.room.frames[target.frame].url);
    // SAM finds the object in the player's photo; its outline is what glows on screen.
    const sam = await segmentImage({
      imageUrl: attempt.dataUrl,
      concept: target.phrase,
      task: `Find the ${target.name} in the camera`,
      timeoutMs: 10_000,
      trace,
      mockBoxes: [
        {
          left: attempt.width * 0.25,
          top: attempt.height * 0.2,
          right: attempt.width * 0.75,
          bottom: attempt.height * 0.8,
        },
      ],
    }).catch(() => null);
    const best = sam?.objects[0];
    if (sam && !best) return { correct: false, message: `I don’t see it in that picture. Get closer and try again.` };

    // Spark Open confirms it is the same object as in the scan, not just one like it.
    const check = await askJSON({
      engine: "sparkOpen",
      task: `Is this the ${target.name}?`,
      system:
        "You compare two photos for a treasure-hunt game. Photo 1 is from a player's camera. Photo 2 is a close-up taken earlier in the same room. Decide if photo 1 clearly shows the same physical object as photo 2. Small changes in angle and light are fine.",
      parts: [text("Photo 1, the player's camera:"), image(attempt.dataUrl), text(`Photo 2, the ${target.name} from the scan:`), image(reference)],
      schema: SameObject,
      schemaName: "same_object",
      timeoutMs: 15_000,
      trace,
      mock: () => ({ same: true, reason: "Same shape and colour." }),
    }).catch(() => null);

    if (!check) {
      // Both checks unavailable: trust SAM if it found the object confidently.
      return best && (best.confidence ?? 0) >= 0.6
        ? { correct: true, outline: { box: best.box, maskPath: best.maskPath, maskBounds: best.maskBounds, maskSize: best.maskSize } }
        : { correct: false, message: "I couldn’t check that one. Try again in a moment, or tap it in the room photos." };
    }
    if (!check.same) return { correct: false, message: "That’s not quite it. Read the clue again." };
    return {
      correct: true,
      outline: best ? { box: best.box, maskPath: best.maskPath, maskBounds: best.maskBounds, maskSize: best.maskSize } : undefined,
    };
  }

  return { correct: false, message: "Point the camera at the object, or tap it in the room photos." };
}
