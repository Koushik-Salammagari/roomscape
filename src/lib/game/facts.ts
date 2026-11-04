import type { Fact } from "./schema";

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, none: 0, one: 1, single: 1, two: 2, pair: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9: ]/g, " ").replace(/\s+/g, " ").trim();

export function toNumber(value: string): number | null {
  const n = norm(value);
  const digits = n.match(/\d+/);
  if (digits) return Number(digits[0]);
  for (const word of n.split(" ")) if (word in NUMBER_WORDS) return NUMBER_WORDS[word];
  return null;
}

function minutesOf(value: string): number | null {
  const m = norm(value).match(/(\d{1,2})[: ](\d{2})/);
  if (!m) return null;
  return (Number(m[1]) % 12) * 60 + Number(m[2]);
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

const STOP = new Set(["the", "a", "an", "of", "and", "with", "in", "on", "light", "dark", "pale", "deep", "bright"]);
const tokens = (s: string) => norm(s).split(" ").filter((t) => t && !STOP.has(t));

/** Do two independent readings of the same detail agree closely enough to trust? */
export function readingsAgree(kind: Fact["kind"], first: string, second: string): boolean {
  const a = norm(first);
  const b = norm(second);
  if (!a || !b || b === "unsure" || b === "not visible") return false;
  if (a === b) return true;

  if (kind === "count") {
    const x = toNumber(a);
    const y = toNumber(b);
    return x !== null && x === y;
  }
  if (kind === "time") {
    const x = minutesOf(a);
    const y = minutesOf(b);
    return x !== null && y !== null && Math.abs(x - y) <= 5;
  }
  if (kind === "text") {
    const longest = Math.max(a.length, b.length);
    return 1 - levenshtein(a, b) / longest >= 0.8;
  }
  // colour, shape, material, position, pattern: share the main word
  const ta = tokens(a);
  const tb = new Set(tokens(b));
  return ta.some((t) => tb.has(t));
}
