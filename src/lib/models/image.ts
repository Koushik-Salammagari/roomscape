import { mockModels } from "@/lib/env";
import { MODELS } from "./ids";
import { metaClient, retrying, sleep, timed, type Trace } from "./runtime";

/** The shared look that keeps every generated image in one storybook. */
export const STORYBOOK_STYLE =
  "hand-inked storybook illustration, warm lantern light against deep blue dusk shadows, " +
  "visible ink linework, soft gouache texture, rich but not neon colours, no text, no lettering";

type ImageOptions = {
  task: string;
  prompt: string;
  /** Reference images as https or data URLs: the room photo, an object cutout. */
  references?: string[];
  timeoutMs?: number;
  trace?: Trace;
};

export type GeneratedImage = { dataUrl: string; mime: string };

type ResponseOutputItem = { type: string; result?: string };

/**
 * Generates or edits an image with Muse Image over the Responses API.
 * With references, the model restyles or composes them instead of starting blank.
 */
export async function generateImage(opts: ImageOptions): Promise<GeneratedImage> {
  if (mockModels) {
    await sleep(700 + Math.random() * 600);
    return mockImage(opts.prompt);
  }
  return timed({ model: "image", task: opts.task, ms: opts.timeoutMs ?? 45_000, trace: opts.trace }, async (signal) => {
    const content: Record<string, string>[] = [{ type: "input_text", text: `${opts.prompt}\n\nStyle: ${STORYBOOK_STYLE}` }];
    for (const url of opts.references ?? []) content.push({ type: "input_image", image_url: url });
    const res = (await retrying(() =>
      metaClient().responses.create(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { model: MODELS.image, input: [{ role: "user", content }], store: false } as any,
        { signal },
      ),
    )) as unknown as { output: ResponseOutputItem[] };
    const result = res.output.find((item) => item.type === "image_generation_call")?.result;
    if (!result) throw new Error(`${opts.task}: Muse Image returned no image.`);
    const mime = sniffMime(result);
    return { dataUrl: `data:${mime};base64,${result}`, mime };
  });
}

function sniffMime(b64: string): string {
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("/9j/")) return "image/jpeg";
  return "image/webp";
}

/** A themed placeholder so the whole flow works before the API key arrives. */
function mockImage(prompt: string): GeneratedImage {
  const hue = [...prompt].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 800'>
    <defs><radialGradient id='g' cx='35%' cy='30%' r='80%'><stop offset='0' stop-color='hsl(${hue},55%,62%)'/><stop offset='.55' stop-color='hsl(${(hue + 40) % 360},45%,28%)'/><stop offset='1' stop-color='#141a3a'/></radialGradient></defs>
    <rect width='600' height='800' fill='url(#g)'/>
    <circle cx='210' cy='240' r='90' fill='#f4b740' opacity='.35'/>
    <path d='M60 700 Q300 560 540 700' stroke='#f6eedc' stroke-width='3' fill='none' stroke-dasharray='10 12' opacity='.6'/>
  </svg>`;
  return { dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, mime: "image/svg+xml" };
}
