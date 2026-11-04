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
  // Keywords only nudge recognition: keep them short, plain and unique, and drop them if the API objects.
  const keywords = [
    ...new Set(
      (opts.keywords ?? [])
        .map((k) => k.replace(/[^\p{L}\p{N} '-]/gu, " ").replace(/\s+/g, " ").trim())
        .filter((k) => k.length >= 2 && k.length <= 40),
    ),
  ].slice(0, 50);

  return timed({ model: "voice", task: "Hear the question", ms: 15_000, trace: opts.trace }, async (signal) => {
    const send = async (withKeywords: boolean) => {
      const request: Record<string, unknown> = { mode: "PUSH_TO_TALK", model: MODELS.voice, audioEncoding: "WAV" };
      if (withKeywords && keywords.length) request.keywords = keywords;
      const form = new FormData();
      // The request settings travel as a JSON part, not as form fields.
      form.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
      form.append("audio", opts.wav, "clip.wav");
      return fetch(`${env.metaBase}/asr/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.metaKey}` },
        body: form,
        signal,
      });
    };
    let res = await send(true);
    if (res.status === 400 && keywords.length) {
      console.warn("[voice] 400 with keywords:", (await res.text()).slice(0, 300));
      res = await send(false);
    }
    if (!res.ok) throw new Error(`Voice Transcribe returned ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const body = (await res.json()) as { transcript?: string; turns?: { transcript?: string }[] };
    return (body.transcript || body.turns?.map((t) => t.transcript ?? "").join(" ") || "").trim();
  });
}
