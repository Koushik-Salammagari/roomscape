/** Every Meta model Roomscape calls at runtime. Nothing else is called. */
export const MODELS = {
  spark: "muse-spark-1.3",
  wonder: "muse-wonder-1.0",
  image: "muse-image-1.0",
  sam: "sam-3.1",
  voice: "muse-voice-transcribe-1.0",
} as const;

export type ModelName = keyof typeof MODELS | "sparkOpen";

/** Display names used in the build theater and the README. */
export const MODEL_LABELS: Record<ModelName, string> = {
  spark: "Muse Spark 1.3",
  wonder: "Muse Wonder 1.0",
  image: "Muse Image 1.0",
  sam: "SAM 3.1",
  voice: "Muse Voice Transcribe 1.0",
  sparkOpen: "Muse Spark Open",
};
