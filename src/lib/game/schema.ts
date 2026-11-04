import { z } from "zod";
import { HostSchema, PlanSchema } from "./plan";
import { PlayerProgressSchema } from "./progress";

/** A still frame grabbed while scanning, stored as an image URL. */
export const FrameSchema = z.object({
  id: z.string(),
  url: z.string(),
  width: z.number(),
  height: z.number(),
});
export type Frame = z.infer<typeof FrameSchema>;

export const FactKind = z.enum(["color", "count", "text", "time", "shape", "material", "position", "pattern"]);

/** One observable detail of an object. Only verified facts may become puzzle answers. */
export const FactSchema = z.object({
  kind: FactKind,
  about: z.string(),
  value: z.string(),
  verified: z.boolean().default(false),
});
export type Fact = z.infer<typeof FactSchema>;

export const BoxSchema = z.object({ left: z.number(), top: z.number(), right: z.number(), bottom: z.number() });
export type Box = z.infer<typeof BoxSchema>;

export const ObjectStatus = z.enum(["listed", "masked", "verified", "dropped"]);

export const RoomObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The short phrase SAM searches for. */
  phrase: z.string(),
  frame: z.number(),
  /** Pixel box in its frame. */
  box: BoxSchema,
  maskPath: z.string().optional(),
  maskBounds: BoxSchema.optional(),
  maskSize: z.object({ width: z.number(), height: z.number() }).optional(),
  crop: z.string().optional(),
  facts: z.array(FactSchema),
  status: ObjectStatus,
  /** Can a player walk up to it and point a camera at it? */
  reachable: z.boolean().default(true),
});
export type RoomObject = z.infer<typeof RoomObjectSchema>;

export const RoomSchema = z.object({
  frames: z.array(FrameSchema),
  objects: z.array(RoomObjectSchema),
  summary: z.string().default(""),
});
export type Room = z.infer<typeof RoomSchema>;

export const GameStage = z.enum(["scanning", "scanned", "setup", "building", "ready", "playing", "solved"]);

export const GameSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  mode: z.enum(["host", "quick"]),
  theme: z.enum(["lost-treasure", "mystery", "heist", "haunted"]),
  difficulty: z.enum(["easy", "normal", "hard"]),
  stage: GameStage,
  room: RoomSchema,
  /** Secret handed to the device that created the game; it unlocks answers for host preview. */
  hostKey: z.string().default(""),
  host: HostSchema.optional(),
  plan: PlanSchema.optional(),
  /** Short, player-safe notes on what each build step did, shown in the build theater. */
  buildNotes: z.array(z.string()).default([]),
  /** playerId → progress. Each device that plays keeps its own run. */
  progress: z.record(z.string(), PlayerProgressSchema).default({}),
});
export type Game = z.infer<typeof GameSchema>;
