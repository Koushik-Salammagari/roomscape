import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { GameNotFound } from "@/lib/store";
import type { CallRecord } from "@/lib/models";

/** Wraps a route handler so every failure returns a clear JSON error. */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof GameNotFound) return NextResponse.json({ error: "This game no longer exists." }, { status: 404 });
      if (error instanceof ZodError) return NextResponse.json({ error: "The request was not in the expected shape.", issues: error.issues }, { status: 400 });
      console.error(error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: 500 });
    }
  };
}

/** Logs every model call in the server log, so failures and timings are visible on Vercel. */
export const logTrace = (record: CallRecord) =>
  console.log(
    `[model] ${record.model} ${record.task} ${record.ok ? "ok" : "failed"} ${record.ms}ms${record.fallback ? ` fallback: ${record.fallback}` : ""}${record.error ? ` error: ${record.error}` : ""}`,
  );
