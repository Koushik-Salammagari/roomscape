import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { newId, storeImage, updateGame } from "@/lib/store";

/** Stores one scan frame. Frames are sent one per request to stay under upload limits. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("frame");
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));
  if (!(file instanceof Blob) || !width || !height) {
    return NextResponse.json({ error: "Send a frame image with its width and height." }, { status: 400 });
  }
  const frameId = newId("f");
  const url = await storeImage(`frames/${id}/${frameId}.jpg`, Buffer.from(await file.arrayBuffer()), file.type || "image/jpeg");
  const game = await updateGame(id, (g) => {
    g.room.frames.push({ id: frameId, url, width, height });
  });
  return NextResponse.json({ frame: game.room.frames.at(-1), count: game.room.frames.length });
});
