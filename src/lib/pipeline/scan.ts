import { z } from "zod";
import { askJSON, image, segmentImage, text, type Trace } from "@/lib/models";
import { FactKind, type Box, type Game, type RoomObject } from "@/lib/game/schema";
import { readingsAgree } from "@/lib/game/facts";
import { modelReadableImage, newId, storeImage } from "@/lib/store";
import { mockInventory, mockSecondReading } from "./mocks";

/* ---------- Step 1: read the room from the scan frames (Muse Spark 1.3) ---------- */

const InventoryReply = z.object({
  summary: z.string(),
  objects: z
    .array(
      z.object({
        name: z.string(),
        phrase: z.string(),
        frame: z.number().int().min(1),
        box: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
        reachable: z.boolean(),
        facts: z.array(z.object({ kind: FactKind, about: z.string(), value: z.string() })).max(5),
      }),
    )
    .min(1),
});
export type InventoryReply = z.infer<typeof InventoryReply>;

const INVENTORY_SYSTEM = `You catalogue a real room for a treasure-hunt game. Players will walk up to objects, look closely at them and answer questions about them.

Rules:
- List 15 to 25 distinct physical objects. Prefer objects with details worth noticing: books, clocks, plants, lamps, cushions, frames, mugs, boxes, shelves, rugs, bottles, plush toys, board games.
- Skip people, pets, screens showing content, documents, mail, medicine, anything private, and anything a player would need to climb to reach.
- "name" is a short natural name ("floor lamp"). "phrase" is the 1 to 3 word noun phrase an object detector should search for ("floor lamp").
- "frame" is the number of the image where the object is clearest (images are numbered from 1).
- "box" locates it in that image as fractions of width and height: x and y are the top-left corner, w and h the size, all between 0 and 1.
- "facts" are up to 5 concrete details a person could check by looking closely: colors, counts ("number of red book spines on the middle shelf"), visible text, the time on a clock, shapes, materials, patterns. Only include details you can actually see. Never guess.
- "summary" is one sentence describing the room.`;

export async function readRoom(game: Game, trace?: Trace): Promise<RoomObject[]> {
  const frames = game.room.frames;
  const parts = [text(`There are ${frames.length} images of the same room, taken while walking through it.`)];
  for (const [i, frame] of frames.entries()) {
    parts.push(text(`Image ${i + 1}:`));
    parts.push(image(await modelReadableImage(frame.url)));
  }
  parts.push(text("Catalogue the room as JSON."));

  const reply = await askJSON({
    engine: "spark",
    task: "Read the room",
    system: INVENTORY_SYSTEM,
    parts,
    schema: InventoryReply,
    schemaName: "room_inventory",
    effort: "medium",
    timeoutMs: 60_000,
    trace,
    mock: () => mockInventory(frames.length),
  });

  game.room.summary = reply.summary;
  const seen = new Set<string>();
  const objects: RoomObject[] = [];
  for (const item of reply.objects) {
    const key = `${item.name.toLowerCase()}#${item.frame}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const index = Math.min(Math.max(item.frame, 1), frames.length) - 1;
    const f = frames[index];
    const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
    objects.push({
      id: newId("o"),
      name: item.name,
      phrase: item.phrase || item.name,
      frame: index,
      box: {
        left: clamp(item.box.x) * f.width,
        top: clamp(item.box.y) * f.height,
        right: clamp(item.box.x + item.box.w) * f.width,
        bottom: clamp(item.box.y + item.box.h) * f.height,
      },
      facts: item.facts.map((fact) => ({ ...fact, verified: false })),
      status: "listed",
      reachable: item.reachable,
    });
  }
  return objects;
}

/* ---------- Step 2: find and mask each object (SAM 3.1) ---------- */

function iou(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const inter = ix * iy;
  const area = (r: Box) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
  return inter / (area(a) + area(b) - inter || 1);
}

/**
 * Masks one object. SAM returns every match of the phrase, so the detection
 * that best overlaps Spark's box is taken. No match keeps Spark's box and
 * marks the object usable for codes, but not for camera hunts.
 */
export async function maskObject(game: Game, object: RoomObject, trace?: Trace): Promise<RoomObject> {
  const frame = game.room.frames[object.frame];
  const jitter = (v: number, s: number) => v + (Math.random() - 0.5) * s * 0.04;
  const result = await segmentImage({
    imageUrl: await modelReadableImage(frame.url),
    concept: object.phrase,
    task: `Mask the ${object.name}`,
    trace,
    mockBoxes: [
      {
        left: jitter(object.box.left, frame.width),
        top: jitter(object.box.top, frame.height),
        right: jitter(object.box.right, frame.width),
        bottom: jitter(object.box.bottom, frame.height),
      },
    ],
  }).catch(() => null);

  const best = result?.objects
    .map((o) => ({ o, score: iou(o.box, object.box) }))
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score < 0.15) return { ...object, reachable: false, status: "listed" };
  return {
    ...object,
    box: best.o.box,
    maskPath: best.o.maskPath,
    maskBounds: best.o.maskBounds,
    maskSize: best.o.maskSize,
    status: "masked",
  };
}

/* ---------- Step 3: re-read every detail from a close-up (Muse Spark 1.3) ---------- */

const SecondReading = z.object({
  answers: z.array(z.object({ objectId: z.string(), about: z.string(), value: z.string() })),
});

const CHECK_SYSTEM = `You check details of objects in close-up photos for a treasure-hunt game. A puzzle will only use a detail if your reading matches an earlier one, so be strict.
For each question, look only at the matching close-up and answer with the value you see. If you cannot see it clearly, answer "unsure". Never guess.`;

export type Crop = { objectId: string; dataUrl: string };

export async function checkDetails(game: Game, crops: Crop[], trace?: Trace): Promise<void> {
  const targets = crops
    .map((crop) => ({ crop, object: game.room.objects.find((o) => o.id === crop.objectId) }))
    .filter((t): t is { crop: Crop; object: RoomObject } => Boolean(t.object && t.object.facts.length));
  if (!targets.length) return;

  const parts = [];
  for (const { crop, object } of targets) {
    const [, mime, b64] = crop.dataUrl.match(/^data:([^;]+);base64,(.+)$/) ?? [];
    if (b64) object.crop = await storeImage(`crops/${game.id}/${object.id}.jpg`, Buffer.from(b64, "base64"), mime);
    parts.push(text(`Close-up of the ${object.name} (objectId ${object.id}). Questions:\n${object.facts.map((f) => `- ${f.about} (${f.kind})`).join("\n")}`));
    parts.push(image(crop.dataUrl));
  }

  const reply = await askJSON({
    engine: "spark",
    task: "Double-check details",
    system: CHECK_SYSTEM,
    parts,
    schema: SecondReading,
    schemaName: "second_reading",
    effort: "low",
    timeoutMs: 45_000,
    trace,
    mock: () => mockSecondReading(targets.map((t) => t.object)),
  });

  for (const { object } of targets) {
    for (const fact of object.facts) {
      const answer = reply.answers.find(
        (a) => a.objectId === object.id && a.about.trim().toLowerCase() === fact.about.trim().toLowerCase(),
      );
      fact.verified = Boolean(answer && readingsAgree(fact.kind, fact.value, answer.value));
    }
    if (object.status === "masked" && object.facts.some((f) => f.verified)) object.status = "verified";
  }
}
