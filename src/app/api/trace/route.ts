import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** The last 100 model calls (model, task, outcome, time, error). No prompts, keys or answers. */
export async function GET() {
  if (!env.redisUrl || !env.redisToken) return NextResponse.json({ calls: [] });
  const redis = new Redis({ url: env.redisUrl, token: env.redisToken });
  return NextResponse.json({ calls: await redis.lrange("trace", 0, 99) });
}
