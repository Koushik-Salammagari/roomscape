import { generateImage, type Trace } from "@/lib/models";
import type { Game } from "@/lib/game/schema";
import { modelReadableImage, storeImage } from "@/lib/store";

const WORLD: Record<Game["theme"], string> = {
  "lost-treasure": "a sea captain's hidden treasure: brass lanterns, rolled maps, rope, old wood and gold glints",
  mystery: "a cosy 1920s country-house whodunit dinner party: candlelight, rain on the tall windows, a magnifying glass, a silver tea set, velvet and polished mahogany",
  heist: "a moonlit midnight heist: velvet ropes, spotlights, long shadows, polished brass",
  haunted: "a gently haunted house: soft moonlight, drifting mist, friendly glowing wisps",
};

export type ArtEvent =
  | { kind: "scene"; url: string }
  | { kind: "character"; stationId: string; url: string }
  | { kind: "fragment"; stationId: string; url: string }
  | { kind: "skipped"; what: string; reason: string };

async function save(game: Game, name: string, dataUrl: string): Promise<string> {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:([^;]+)/)?.[1] ?? "image/webp";
  const ext = mime.split("/")[1].split("+")[0];
  return storeImage(`art/${game.id}/${name}.${ext}`, Buffer.from(b64, "base64"), mime);
}

/** The frame with the most usable objects makes the best scene. */
export function bestFrame(game: Game): number {
  const counts = game.room.frames.map((_, i) => game.room.objects.filter((o) => o.frame === i && o.status !== "dropped").length);
  return counts.indexOf(Math.max(...counts));
}

/**
 * Paints the game with Muse Image: the room restyled into the story, a
 * character for every station object made from its own cutout, and the
 * picture-fragment image. Jobs run in parallel and report as each finishes.
 */
export async function paintGame(game: Game, onEvent: (e: ArtEvent) => void, trace?: Trace): Promise<void> {
  const plan = game.plan!;
  const sceneFrame = bestFrame(game);
  plan.sceneFrame = sceneFrame;

  const jobs: Promise<void>[] = [];

  jobs.push(
    (async () => {
      const frame = await modelReadableImage(game.room.frames[sceneFrame].url);
      const paint = (world: string) =>
        generateImage({
          task: "Paint the room into the story",
          prompt: `Repaint this exact room as an illustration from a storybook about ${world}. Keep every piece of furniture and every object in the same place, size and shape, so the players recognise their own room. Change only the style, the light and the atmosphere. No people.`,
          references: [frame],
          timeoutMs: 90_000,
          trace,
        });
      // If a story's words trip the image filter, fall back to a plain cosy evening scene.
      const img = await paint(WORLD[game.theme]).catch(() => paint("a cosy evening adventure: warm lamplight, deep blue shadows and a sense of mystery"));
      plan.scene = await save(game, "scene", img.dataUrl);
      onEvent({ kind: "scene", url: plan.scene });
    })().catch((e) => onEvent({ kind: "skipped", what: "scene", reason: String(e) })),
  );

  for (const station of plan.stations) {
    const object = game.room.objects.find((o) => o.id === station.objectId);
    if (!object) continue;
    const reference = await modelReadableImage(object.crop ?? game.room.frames[object.frame].url);
    const subject = object.crop ? `this ${object.name}` : `the ${object.name} in this photo`;

    jobs.push(
      (async () => {
        const img = await generateImage({
          task: `Bring the ${object.name} to life`,
          prompt: `Redraw ${subject} from scratch as a storybook character named ${station.character.name}: ${station.character.persona} This is an illustration, not a photo edit. Keep its real shape, colours and materials so it is clearly the same object, and give it big expressive eyes and a friendly mouth on its most recognisable part. Square portrait: the character fills most of the frame and is centred on a plain deep-blue background with soft light. If the object is tall and thin, frame its top half up close so the face is large.`,
          references: [reference],
          timeoutMs: 90_000,
          trace,
        });
        station.character.art = await save(game, `char-${station.id}`, img.dataUrl);
        onEvent({ kind: "character", stationId: station.id, url: station.character.art });
      })().catch((e) => onEvent({ kind: "skipped", what: station.character.name, reason: String(e) })),
    );

    if (station.type === "picture-fragment") {
      jobs.push(
        (async () => {
          const img = await generateImage({
            task: "Paint the picture fragment",
            prompt: `Paint a close-up of ${subject} as a torn fragment of an old illustrated map from ${WORLD[game.theme]}. Keep its shape, colours and pattern recognisable, crop in tightly, and give the paper torn edges. No text.`,
            references: [reference],
            timeoutMs: 90_000,
            trace,
          });
          station.image = await save(game, `frag-${station.id}`, img.dataUrl);
          onEvent({ kind: "fragment", stationId: station.id, url: station.image });
        })().catch((e) => onEvent({ kind: "skipped", what: "picture fragment", reason: String(e) })),
      );
    }
  }

  await Promise.all(jobs);
}
