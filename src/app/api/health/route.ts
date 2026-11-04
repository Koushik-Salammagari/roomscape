import { NextResponse } from "next/server";
import { env, hasBaseten, mockModels } from "@/lib/env";
import { MODEL_LABELS } from "@/lib/models";

export const dynamic = "force-dynamic";

/** Reports which mode the model layer is in. Never returns keys. */
export function GET() {
  return NextResponse.json({
    ok: true,
    mockModels,
    storage: {
      games: env.redisUrl && env.redisToken ? "Upstash Redis" : "memory (not saved between requests)",
      images: env.blobToken ? "Vercel Blob" : "memory (not saved between requests)",
    },
    sparkOpenOn: hasBaseten ? "Baseten" : "Muse Spark 1.3 (no Baseten key)",
    models: Object.values(MODEL_LABELS),
  });
}
