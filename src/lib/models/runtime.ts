import OpenAI from "openai";
import { env } from "@/lib/env";
import type { ModelName } from "./ids";

let meta: OpenAI | null = null;
let baseten: OpenAI | null = null;

export function metaClient(): OpenAI {
  meta ??= new OpenAI({ baseURL: env.metaBase, apiKey: env.metaKey, maxRetries: 1 });
  return meta;
}

export function basetenClient(): OpenAI {
  baseten ??= new OpenAI({ baseURL: env.basetenBase, apiKey: env.basetenKey, maxRetries: 1 });
  return baseten;
}

/** One record per model call, so the build theater and logs can show what ran. */
export type CallRecord = {
  model: ModelName;
  task: string;
  ms: number;
  ok: boolean;
  fallback?: string;
  error?: string;
};

export type Trace = (record: CallRecord) => void;

export const noTrace: Trace = () => {};

export class ModelTimeoutError extends Error {
  constructor(task: string, ms: number) {
    super(`${task} took longer than ${Math.round(ms / 1000)}s`);
    this.name = "ModelTimeoutError";
  }
}

/** Runs one model call with a hard time limit and records it. */
export async function timed<T>(
  opts: { model: ModelName; task: string; ms: number; trace?: Trace },
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ModelTimeoutError(opts.task, opts.ms));
    }, opts.ms);
  });
  try {
    const value = await Promise.race([run(controller.signal), timeout]);
    opts.trace?.({ model: opts.model, task: opts.task, ms: Date.now() - started, ok: true });
    return value;
  } catch (error) {
    opts.trace?.({
      model: opts.model,
      task: opts.task,
      ms: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Tries the primary call; on any failure runs the fallback and notes why. */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: (reason: unknown) => Promise<T>,
): Promise<T> {
  try {
    return await primary();
  } catch (reason) {
    return fallback(reason);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
