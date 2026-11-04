import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { Redis } from "@upstash/redis";
import { env, hasBaseten, mockModels } from "@/lib/env";
import { askJSON, generateImage, image, segmentImage, text, transcribe } from "@/lib/models";
import { storeImage } from "@/lib/store";
import { metaClient } from "@/lib/models/runtime";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * Calls each Meta model once with a test photo and reports timing and a short
 * sample of the reply. It never returns keys. Limited to one run a minute,
 * since each run costs a few cents.
 */
export async function POST(req: Request) {
  const only = new URL(req.url).searchParams.get("only");
  if (env.redisUrl && env.redisToken) {
    const redis = new Redis({ url: env.redisUrl, token: env.redisToken });
    const fresh = await redis.set("probe:lock", "1", { nx: true, ex: 60 });
    if (!fresh) return NextResponse.json({ error: "A model check ran less than a minute ago." }, { status: 429 });
  }

  const photo = await readFile(path.join(process.cwd(), "public/probe/room.jpg"));
  const photoUrl = `data:image/jpeg;base64,${photo.toString("base64")}`;
  const results: Record<string, unknown> = { mockModels, sparkOpenOn: hasBaseten ? "Baseten" : "Spark 1.3 fallback" };

  const run = async (name: string, fn: () => Promise<unknown>) => {
    if (only && only !== name) return;
    const started = Date.now();
    try {
      const value = await fn();
      results[name] = { ok: true, ms: Date.now() - started, sample: value };
    } catch (error) {
      results[name] = { ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
    }
  };

  const Objects = z.object({ objects: z.array(z.object({ name: z.string(), detail: z.string() })) });

  await Promise.all([
    run("models", async () => {
      const list = await metaClient().models.list();
      return list.data.map((m) => m.id);
    }),
    run("spark", () =>
      askJSON({
        engine: "spark",
        task: "Probe: list objects",
        system: "You list objects you can see in a photo.",
        parts: [text("List up to 5 objects in this photo with one visible detail each."), image(photoUrl)],
        schema: Objects,
        schemaName: "objects",
        effort: "low",
        timeoutMs: 40_000,
        mock: () => ({ objects: [{ name: "lamp", detail: "cream shade" }] }),
      }),
    ),
    run("wonder", () =>
      askJSON({
        engine: "wonder",
        task: "Probe: one riddle",
        system: "You write riddles for a treasure hunt.",
        parts: [text("Write one short riddle whose answer is a floor lamp.")],
        schema: z.object({ riddle: z.string(), answer: z.string() }),
        schemaName: "riddle",
        effort: "low",
        timeoutMs: 60_000,
        mock: () => ({ riddle: "I sleep all day and wake at dusk.", answer: "floor lamp" }),
      }),
    ),
    run("sparkOpen", () =>
      askJSON({
        engine: "sparkOpen",
        task: "Probe: judge an answer",
        system: "You judge whether a player's answer matches the expected answer. Be generous with synonyms.",
        parts: [text('Expected: "floor lamp". Player said: "the standing light". Does it match?')],
        schema: z.object({ match: z.boolean(), reason: z.string() }),
        schemaName: "judgement",
        timeoutMs: 30_000,
        mock: () => ({ match: true, reason: "A standing light is a floor lamp." }),
      }),
    ),
    run("sam", async () => {
      const r = await segmentImage({ imageUrl: photoUrl, concept: "bookshelf", timeoutMs: 30_000 });
      return r.objects.map((o) => ({
        box: o.box,
        confidence: o.confidence,
        hasMask: Boolean(o.maskPath),
        maskSize: o.maskSize,
      }));
    }),
    run("image", async () => {
      const r = await generateImage({
        task: "Probe: restyle room",
        prompt: "Redraw this room as a scene from a treasure-hunt storybook. Keep every piece of furniture where it is.",
        references: [photoUrl],
        timeoutMs: 90_000,
      });
      const [, b64] = r.dataUrl.split(",");
      const url = await storeImage(`probe/restyle.${r.mime.split("/")[1].split("+")[0]}`, Buffer.from(b64, "base64"), r.mime);
      return { mime: r.mime, url };
    }),
    run("voice", async () => {
      const wav = await readFile(path.join(process.cwd(), "public/probe/silence.wav"));
      const transcript = await transcribe({ wav: new Blob([new Uint8Array(wav)], { type: "audio/wav" }), mock: "" });
      return { transcript, note: "A second of silence: an empty transcript means the endpoint accepted the format." };
    }),
  ]);

  return NextResponse.json(results);
}
