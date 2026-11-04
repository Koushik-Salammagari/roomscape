import { z } from "zod";

export const StationType = z.enum(["riddle-hunt", "observation-code", "cipher", "logic", "picture-fragment"]);
export type StationType = z.infer<typeof StationType>;

export const VoiceStyle = z.enum(["low", "high", "warm", "crisp", "creaky"]);

export const CharacterSchema = z.object({
  name: z.string(),
  /** One line: who this object is in the story and how it talks. */
  persona: z.string(),
  /** Spoken when the station opens. */
  greeting: z.string(),
  voice: VoiceStyle,
  /** Muse Image character portrait, made from the object's own cutout. */
  art: z.string().optional(),
});
export type Character = z.infer<typeof CharacterSchema>;

export const StationSchema = z.object({
  id: z.string(),
  type: StationType,
  /** The object the puzzle is about (for hunts, the object to find). */
  objectId: z.string(),
  title: z.string(),
  character: CharacterSchema,
  /** What the player reads. */
  prompt: z.string(),
  /** Exact answer: an object id, a number, or a word. Never sent to players. */
  answer: z.string(),
  /** Logic teasers: the statements and the choices. */
  statements: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  /** Picture fragments: the image the player has to place. */
  image: z.string().optional(),
  hints: z.tuple([z.string(), z.string(), z.string()]),
  /** Stations that must be solved before this one opens. */
  after: z.array(z.string()),
  /** The final-lock digit this station hands over when solved. */
  digit: z.number().int().min(0).max(9),
  /** How the station was proven solvable before play. */
  check: z.enum(["solved-blind", "code", "template"]),
});
export type Station = z.infer<typeof StationSchema>;

export const PlanSchema = z.object({
  title: z.string(),
  intro: z.string(),
  /** What the players find at the end. */
  treasure: z.string(),
  epilogue: z.string(),
  /** Where to look at the end. In a hosted hunt this is the real gift's spot. */
  reveal: z.string(),
  stations: z.array(StationSchema),
  finalCode: z.string(),
  /** Muse Image: the room restyled into the story's world. */
  scene: z.string().optional(),
  /** Which room frame the scene was made from. */
  sceneFrame: z.number().optional(),
  designedBy: z.enum(["Muse Wonder 1.0", "Muse Spark 1.3"]),
});
export type Plan = z.infer<typeof PlanSchema>;

export const HostSchema = z.object({
  prizeObjectId: z.string().optional(),
  /** The host's own words for where the gift is, e.g. "under the left cushion". */
  prizeNote: z.string().optional(),
  pinned: z.array(z.string()).default([]),
  blocked: z.array(z.string()).default([]),
  player: z.string().optional(),
  occasion: z.string().optional(),
  jokes: z.string().optional(),
});
export type Host = z.infer<typeof HostSchema>;

export const STATION_COUNT = { easy: 4, normal: 5, hard: 6 } as const;
