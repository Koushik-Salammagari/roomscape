import {
  decodeMaskToSVGPath,
  parseImageStream,
  recordsOfKind,
  type ResponsesEvent,
} from "@meta-sam/parser";
import { mockModels } from "@/lib/env";
import { MODELS } from "./ids";
import { metaClient, sleep, timed, type Trace } from "./runtime";

/** One object SAM found, in source-image pixels. */
export type SamObject = {
  objectId: string;
  box: { left: number; top: number; right: number; bottom: number };
  confidence?: number;
  /** SVG path of the mask in the mask raster's own coordinates. */
  maskPath?: string;
  /** Where the mask raster sits in the source image, and its raster size. */
  maskBounds?: { left: number; top: number; right: number; bottom: number };
  maskSize?: { width: number; height: number };
};

export type SamResult = { concept: string; objects: SamObject[] };

/**
 * The API streams `response.content_part.done` but not always
 * `response.output_text.done`, which the parser needs to close a text lane.
 * This adds the missing event once per lane.
 */
async function* closeTextLanes(stream: AsyncIterable<unknown>): AsyncIterable<ResponsesEvent> {
  const closed = new Set<string>();
  for await (const raw of stream) {
    const event = raw as {
      type?: string;
      item_id?: unknown;
      output_index?: unknown;
      content_index?: unknown;
      part?: { type?: unknown; text?: unknown } | null;
    };
    const lane = `${String(event.item_id)}:${String(event.output_index)}:${String(event.content_index)}`;
    if (event.type === "response.output_text.done") {
      if (closed.has(lane)) continue;
      closed.add(lane);
    }
    yield event as unknown as ResponsesEvent;
    if (
      event.type === "response.content_part.done" &&
      !closed.has(lane) &&
      event.part?.type === "output_text" &&
      typeof event.part.text === "string"
    ) {
      closed.add(lane);
      yield {
        type: "response.output_text.done",
        item_id: event.item_id,
        output_index: event.output_index,
        content_index: event.content_index,
        text: event.part.text,
      } as unknown as ResponsesEvent;
    }
  }
}

/**
 * Segments every match of a short noun phrase in one image.
 * `imageUrl` is an https or data URL.
 */
export async function segmentImage(opts: {
  imageUrl: string;
  concept: string;
  task?: string;
  timeoutMs?: number;
  trace?: Trace;
  /** Sample boxes for mock mode. */
  mockBoxes?: SamObject["box"][];
}): Promise<SamResult> {
  const concept = opts.concept.trim();
  if (!concept) throw new Error("SAM needs a short noun phrase.");

  if (mockModels) {
    await sleep(250 + Math.random() * 350);
    return {
      concept,
      objects: (opts.mockBoxes ?? []).map((box, i) => ({ objectId: String(i), box, confidence: 0.9 })),
    };
  }

  return timed({ model: "sam", task: opts.task ?? `Find "${concept}"`, ms: opts.timeoutMs ?? 12_000, trace: opts.trace }, async (signal) => {
    const stream = await metaClient().responses.create(
      {
        model: MODELS.sam,
        stream: true,
        input: [
          {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: concept },
              { type: "input_image", image_url: opts.imageUrl },
            ],
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { signal },
    );
    const result = await parseImageStream(closeTextLanes(stream as unknown as AsyncIterable<unknown>)).finalResult;
    if (result.outcome.status !== "completed") {
      throw new Error(`SAM did not finish: ${result.outcome.status}`);
    }

    const byId = new Map<string, SamObject>();
    for (const box of recordsOfKind(result.records, "box")) {
      byId.set(box.objectId, {
        objectId: box.objectId,
        box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
        confidence: box.confidence,
      });
    }
    for (const mask of recordsOfKind(result.records, "mask")) {
      const entry: SamObject = byId.get(mask.objectId) ?? { objectId: mask.objectId, box: { ...mask.bounds } };
      entry.maskPath = decodeMaskToSVGPath(mask.mask);
      entry.maskBounds = mask.bounds;
      entry.maskSize = { width: mask.mask.width, height: mask.mask.height };
      entry.confidence ??= mask.confidence;
      byId.set(mask.objectId, entry);
    }
    return { concept, objects: [...byId.values()].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)) };
  });
}
