/** Server-only configuration. Never import this from a client component. */
export const env = {
  metaKey: process.env.MODEL_API_KEY ?? "",
  metaBase: process.env.MODEL_API_BASE ?? "https://api.meta.ai/v1",
  basetenKey: process.env.BASETEN_API_KEY ?? "",
  basetenBase: process.env.BASETEN_BASE_URL ?? "https://inference.baseten.co/v1",
  sparkOpenModel: process.env.SPARK_OPEN_MODEL ?? "meta-models/muse-spark-open-1026",
  redisUrl: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "",
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "",
  blobToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",
};

/** Mock mode runs every model call against sample replies. On when there is no Meta key. */
export const mockModels = process.env.MOCK_MODELS === "1" || !env.metaKey;

/** Spark Open runs on Baseten only when a Baseten key is set; otherwise its calls go to Spark 1.3. */
export const hasBaseten = Boolean(env.basetenKey);
