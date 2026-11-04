import { readImage } from "@/lib/store";

/** Serves stored images: from the private Blob store in production, from memory locally. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const media = await readImage(key.map(decodeURIComponent).join("/"));
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(media.data), {
    headers: { "Content-Type": media.mime, "Cache-Control": "private, max-age=86400, immutable" },
  });
}
