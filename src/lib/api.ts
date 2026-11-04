import { NextResponse, after } from "next/server";
import { ZodError } from "zod";
import { GameNotFound } from "@/lib/store";
import type { CallRecord } from "@/lib/models";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

const redis = env.redisUrl && env.redisToken ? new Redis({ url: env.redisUrl, token: env.redisToken }) : null;

/** Wraps a route handler so every failure returns a clear JSON error. */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof GameNotFound) return NextResponse.json({ error: "This game no longer exists." }, { status: 404 });
      if (error instanceof ZodError) return NextResponse.json({ error: "The request was not in the expected shape.", issues: error.issues }, { status: 400 });
      console.error(error);
      // Programming errors read badly on a phone; our own errors are written for players.
      const internal = error instanceof TypeError || error instanceof ReferenceError || error instanceof RangeError || error instanceof SyntaxError;
      const message = internal || !(error instanceof Error) ? "Something went wrong on our side. Please try again." : error.message;
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

/** Logs every model call in the server log, so failures and timings are visible on Vercel. */
export const logTrace = (record: CallRecord) => {
  const line = `${new Date().toISOString().slice(11, 19)} ${record.model} | ${record.task} | ${record.ok ? "ok" : "failed"} | ${record.ms}ms${record.fallback ? ` | fallback: ${record.fallback}` : ""}${record.error ? ` | ${record.error}` : ""}`;
  console.log(`[model] ${line}`);
  // Keep the last 100 calls in Redis so failures can be inspected without server logs.
  // `after` keeps the function alive until the write lands; outside a request it runs directly.
  const write = () => redis?.lpush("trace", line).then(() => redis.ltrim("trace", 0, 99)).catch(() => {});
  try {
    after(write);
  } catch {
    void write();
  }
};
