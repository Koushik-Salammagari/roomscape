import { NextResponse } from "next/server";
import { hasBaseten, mockModels } from "@/lib/env";
import { MODEL_LABELS } from "@/lib/models";

export const dynamic = "force-dynamic";

/** Reports which mode the model layer is in. Never returns keys. */
export function GET() {
  return NextResponse.json({
    ok: true,
    mockModels,
    sparkOpenOn: hasBaseten ? "Baseten" : "Muse Spark 1.3 (no Baseten key)",
    models: Object.values(MODEL_LABELS),
  });
}
