import { env, mockModels } from "@/lib/env";
import { MODELS } from "./ids";
import { sleep, timed, type Trace } from "./runtime";

/**
 * Transcribes one push-to-talk clip with Muse Voice Transcribe.
 * The file endpoint takes WAV, so the phone converts its recording first.
 */
export async function transcribe(opts: {
  wav: Blob;
  /** Words to bias recognition toward: character names, answers. */
  keywords?: string[];
  trace?: Trace;
  mock?: string;
}): Promise<string> {
  if (mockModels) {
    await sleep(400);
    return opts.mock ?? "Where were you when the lights went out?";
  }
  return timed({ model: "voice", task: "Hear the question", ms: 12_000, trace: opts.trace }, async (signal) => {
    const request: Record<string, unknown> = {
      mode: "PUSH_TO_TALK",
      model: MODELS.voice,
      audioEncoding: "WAV",
    };
    if (opts.keywords?.length) request.keywords = opts.keywords.slice(0, 50);

    const form = new FormData();
    // The request settings travel as a JSON part, not as form fields.
    form.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
    form.append("audio", opts.wav, "clip.wav");

    const res = await fetch(`${env.metaBase}/asr/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.metaKey}` },
      body: form,
      signal,
    });
    if (!res.ok) throw new Error(`Voice Transcribe returned ${res.status}`);
    const body = (await res.json()) as { transcript?: string; turns?: { transcript?: string }[] };
    return (body.transcript ?? body.turns?.map((t) => t.transcript ?? "").join(" ") ?? "").trim();
  });
}
