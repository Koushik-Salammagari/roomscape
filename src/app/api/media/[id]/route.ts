import { readMemoryImage } from "@/lib/store";

/** Serves images stored in memory during local development. Production uses Blob URLs. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = readMemoryImage(id);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(media.data), {
    headers: { "Content-Type": media.mime, "Cache-Control": "public, max-age=86400" },
  });
}
