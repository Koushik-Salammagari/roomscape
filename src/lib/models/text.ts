import { z } from "zod";
import { hasBaseten, mockModels, env } from "@/lib/env";
import { MODELS, type ModelName } from "./ids";
import { basetenClient, metaClient, sleep, timed, type Trace } from "./runtime";

/** A piece of a user message: text or an image (https or data URL). */
export type Part = { type: "text"; text: string } | { type: "image"; url: string };

type Engine = "spark" | "wonder" | "sparkOpen";
type Effort = "minimal" | "low" | "medium" | "high";

type AskOptions<S extends z.ZodType> = {
  engine: Engine;
  task: string;
  system: string;
  parts: Part[];
  schema: S;
  schemaName: string;
  effort?: Effort;
  timeoutMs: number;
  trace?: Trace;
  /** The sample reply used in mock mode. */
  mock: () => z.infer<S>;
};

export const text = (t: string): Part => ({ type: "text", text: t });
export const image = (url: string): Part => ({ type: "image", url });

function messages(system: string, parts: Part[], repair?: string) {
  const content = parts.map((p) =>
    p.type === "text" ? { type: "text" as const, text: p.text } : { type: "image_url" as const, image_url: { url: p.url } },
  );
  if (repair) content.push({ type: "text", text: repair });
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content },
  ];
}

function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** Pulls the JSON object out of a reply, tolerating code fences or stray prose. */
export function extractJSON(reply: string): unknown {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : reply;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The reply contained no JSON object.");
  return JSON.parse(body.slice(start, end + 1));
}

function route(engine: Engine): { client: ReturnType<typeof metaClient>; model: string; name: ModelName } {
  if (engine === "sparkOpen" && hasBaseten) return { client: basetenClient(), model: env.sparkOpenModel, name: "sparkOpen" };
  if (engine === "wonder") return { client: metaClient(), model: MODELS.wonder, name: "wonder" };
  return { client: metaClient(), model: MODELS.spark, name: "spark" };
}

async function callOnce(
  engine: Engine,
  opts: AskOptions<z.ZodType>,
  repair: string | undefined,
): Promise<string> {
  const { client, model, name } = route(engine);
  return timed({ model: name, task: opts.task, ms: opts.timeoutMs, trace: opts.trace }, async (signal) => {
    const body: Record<string, unknown> = {
      model,
      messages: messages(opts.system, opts.parts, repair),
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schemaName, schema: jsonSchemaOf(opts.schema) },
      },
    };
    if (opts.effort && engine !== "sparkOpen") body.reasoning_effort = opts.effort;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await client.chat.completions.create(body as any, { signal });
    return (res as OpenAIChat).choices[0]?.message?.content ?? "";
  });
}

type OpenAIChat = { choices: { message?: { content?: string | null } }[] };

/**
 * Asks a Meta text model for JSON matching `schema`. Validates with Zod and
 * retries once with the validation errors. Spark Open falls back to Spark 1.3.
 */
export async function askJSON<S extends z.ZodType>(opts: AskOptions<S>): Promise<z.infer<S>> {
  if (mockModels) {
    await sleep(350 + Math.random() * 500);
    return opts.schema.parse(opts.mock());
  }

  const attempt = async (engine: Engine): Promise<z.infer<S>> => {
    let repair: string | undefined;
    for (let round = 0; round < 2; round += 1) {
      const reply = await callOnce(engine, opts as AskOptions<z.ZodType>, repair);
      let data: unknown;
      try {
        data = extractJSON(reply);
      } catch (error) {
        repair = `Your last reply was not valid JSON (${(error as Error).message}). Reply again with only the JSON object.`;
        continue;
      }
      const parsed = opts.schema.safeParse(data);
      if (parsed.success) return parsed.data;
      repair = `Your last reply did not match the required shape: ${parsed.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
        .join("; ")}. Reply again with only the corrected JSON object.`;
    }
    throw new Error(`${opts.task}: the model's reply never matched the schema.`);
  };

  if (opts.engine === "sparkOpen" && hasBaseten) {
    try {
      return await attempt("sparkOpen");
    } catch {
      opts.trace?.({ model: "spark", task: opts.task, ms: 0, ok: true, fallback: "Spark Open unavailable" });
      return attempt("spark");
    }
  }
  return attempt(opts.engine);
}

/** Free-text reply, used for in-character conversation. */
export async function askText(opts: {
  engine: Engine;
  task: string;
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
  timeoutMs: number;
  trace?: Trace;
  mock: () => string;
}): Promise<string> {
  if (mockModels) {
    await sleep(300 + Math.random() * 400);
    return opts.mock();
  }
  const run = async (engine: Engine) => {
    const { client, model, name } = route(engine);
    return timed({ model: name, task: opts.task, ms: opts.timeoutMs, trace: opts.trace }, async (signal) => {
      const res = await client.chat.completions.create(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { model, messages: [{ role: "system", content: opts.system }, ...opts.history] } as any,
        { signal },
      );
      return ((res as OpenAIChat).choices[0]?.message?.content ?? "").trim();
    });
  };
  if (opts.engine === "sparkOpen" && hasBaseten) {
    try {
      return await run("sparkOpen");
    } catch {
      return run("spark");
    }
  }
  return run(opts.engine);
}
