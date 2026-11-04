import { Redis } from "@upstash/redis";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { env } from "@/lib/env";
import { GameSchema, type Game } from "@/lib/game/schema";

/**
 * Game files live in Upstash Redis and images in Vercel Blob. Without those
 * credentials (local development) both fall back to process memory.
 */
const memory = globalThis as unknown as {
  __games?: Map<string, string>;
  __media?: Map<string, { mime: string; data: Buffer }>;
};
memory.__games ??= new Map();
memory.__media ??= new Map();

const redis = env.redisUrl && env.redisToken ? new Redis({ url: env.redisUrl, token: env.redisToken }) : null;
const GAME_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function saveGame(game: Game): Promise<void> {
  const json = JSON.stringify(game);
  if (redis) await redis.set(`game:${game.id}`, json, { ex: GAME_TTL_SECONDS });
  else memory.__games!.set(game.id, json);
}

export async function loadGame(id: string): Promise<Game | null> {
  const raw = redis ? await redis.get<string | object>(`game:${id}`) : memory.__games!.get(id);
  if (!raw) return null;
  return GameSchema.parse(typeof raw === "string" ? JSON.parse(raw) : raw);
}

/** Loads, changes and saves a game. Pipeline steps use this to stay small and resumable. */
export async function updateGame(id: string, change: (game: Game) => void | Promise<void>): Promise<Game> {
  const game = await loadGame(id);
  if (!game) throw new GameNotFound(id);
  await change(game);
  await saveGame(game);
  return game;
}

export class GameNotFound extends Error {
  constructor(id: string) {
    super(`No game with id ${id}`);
    this.name = "GameNotFound";
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${nanoid(10)}`;
}

/** Stores an image and returns a URL the phone and the models can both read. */
export async function storeImage(path: string, data: Buffer, mime: string): Promise<string> {
  if (env.blobToken) {
    const blob = await put(path, data, { access: "public", contentType: mime, addRandomSuffix: true });
    return blob.url;
  }
  const id = nanoid(12);
  memory.__media!.set(id, { mime, data });
  return `/api/media/${id}`;
}

export function readMemoryImage(id: string) {
  return memory.__media!.get(id) ?? null;
}

/** Turns a stored image URL into something a model can read: https stays, local becomes a data URL. */
export async function modelReadableImage(url: string): Promise<string> {
  if (url.startsWith("https://") || url.startsWith("data:")) return url;
  const id = url.split("/").pop()!;
  const media = readMemoryImage(id);
  if (!media) throw new Error(`Image ${url} is missing`);
  return `data:${media.mime};base64,${media.data.toString("base64")}`;
}
