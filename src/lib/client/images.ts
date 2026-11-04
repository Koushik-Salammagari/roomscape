"use client";

import type { Box } from "@/lib/game/schema";

export type LocalFrame = { blob: Blob; dataUrl: string; width: number; height: number };

/** Frames are sent to the models; 1024 px keeps details readable without heavy requests. */
const LONG_SIDE = 1024;

function canvasFor(width: number, height: number, longSide = LONG_SIDE) {
  const scale = Math.min(1, longSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  return canvas;
}

async function toFrame(canvas: HTMLCanvasElement): Promise<LocalFrame> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the frame."))), "image/jpeg", 0.82),
  );
  return { blob, dataUrl: canvas.toDataURL("image/jpeg", 0.82), width: canvas.width, height: canvas.height };
}

/** Grabs the current camera picture, scaled so its long side is 1280 px. */
export async function grabFrame(video: HTMLVideoElement): Promise<LocalFrame> {
  const canvas = canvasFor(video.videoWidth, video.videoHeight);
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return toFrame(canvas);
}

/** Turns an uploaded photo into a scan frame. */
export async function photoToFrame(file: File): Promise<LocalFrame> {
  const bitmap = await createImageBitmap(file);
  const canvas = canvasFor(bitmap.width, bitmap.height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return toFrame(canvas);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the frame image."));
    img.src = src;
  });
}

/** Cuts a close-up of one object out of its frame, with a margin, for the second reading. */
export async function cropObject(frameSrc: string, box: Box, margin = 0.14): Promise<string> {
  const img = await loadImage(frameSrc);
  const w = box.right - box.left;
  const h = box.bottom - box.top;
  const left = Math.max(0, box.left - w * margin);
  const top = Math.max(0, box.top - h * margin);
  const right = Math.min(img.naturalWidth, box.right + w * margin);
  const bottom = Math.min(img.naturalHeight, box.bottom + h * margin);
  const canvas = canvasFor(right - left, bottom - top, 640);
  canvas.getContext("2d")!.drawImage(img, left, top, right - left, bottom - top, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}
