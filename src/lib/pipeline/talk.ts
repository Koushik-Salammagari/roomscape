import { askText, type Trace } from "@/lib/models";
import type { Game } from "@/lib/game/schema";
import type { Station } from "@/lib/game/plan";

export type Turn = { role: "player" | "character"; text: string };

/** Words that would give the answer away if the character said them. */
export function secretWords(game: Game, station: Station): string[] {
  const words = new Set<string>();
  const add = (s: string) =>
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 || /^\d+$/.test(w))
      .forEach((w) => words.add(w));
  if (station.type === "riddle-hunt" || station.type === "picture-fragment") {
    const target = game.room.objects.find((o) => o.id === station.answer || o.id === station.objectId);
    if (target) add(target.name);
  } else {
    add(station.answer);
  }
  // Generic words that happen to be in object names but say nothing on their own.
  for (const w of ["the", "and", "with", "small", "large", "big", "little", "left", "right", "top", "front", "back"]) words.delete(w);
  return [...words];
}

export function leaks(reply: string, secrets: string[]): boolean {
  const said = new Set(reply.toLowerCase().split(/[^a-z0-9]+/));
  // Numbers leak as digits or as words.
  return secrets.some((s) => said.has(s) || said.has(s + "s") || (s.endsWith("s") && said.has(s.slice(0, -1))));
}

function systemPrompt(game: Game, station: Station, solved: boolean, hintsShown: number, secrets: string[]): string {
  const plan = game.plan!;
  const c = station.character;
  const lines = [
    `You are ${c.name}, a character in a treasure hunt called "${plan.title}". ${c.persona}`,
    `The story so far: ${plan.intro}`,
    `The player is standing in a real room, working on your clue. Your clue reads: "${station.prompt}"`,
    solved
      ? "The player has already solved your clue. Congratulate them, chat in character, and point them back to the case board for the next clue."
      : [
          "The player has not solved your clue yet. Help like a playful friend: encourage, react to what they say, and answer questions about the story.",
          `Never say the answer or any of these words: ${secrets.join(", ")}. Never confirm or deny a guess; tell them to check it with the buttons on screen.`,
          hintsShown
            ? `They have already seen these hints, which you may repeat in your own words: ${station.hints.slice(0, hintsShown).join(" / ")}`
            : "They have seen no hints yet. If they ask for help, give only a gentle nudge about where to look or how to think, and mention they can ask for a hint.",
        ].join(" "),
    game.host?.player ? `The player's name is ${game.host.player}.` : "",
    game.host?.occasion ? `The occasion: ${game.host.occasion}.` : "",
    "Reply in one or two short spoken sentences, under 40 words, in your own voice. No lists, no emoji, no stage directions, no quotation marks.",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Muse Spark Open plays the clue's character. A guard checks the reply never gives the answer away. */
export async function talkInCharacter(opts: {
  game: Game;
  station: Station;
  solved: boolean;
  hintsShown: number;
  history: Turn[];
  said: string;
  trace?: Trace;
}): Promise<{ reply: string; guarded: boolean }> {
  const { game, station, solved, hintsShown } = opts;
  const secrets = solved ? [] : secretWords(game, station);
  const history = [
    ...opts.history.slice(-6).map((t) => ({ role: t.role === "player" ? ("user" as const) : ("assistant" as const), content: t.text })),
    { role: "user" as const, content: opts.said },
  ];
  const ask = (system: string) =>
    askText({
      engine: "sparkOpen",
      task: `Talk as ${station.character.name}`,
      system,
      history,
      effort: "low",
      timeoutMs: 25_000,
      trace: opts.trace,
      mock: () => `Ooh, good question. I can’t just tell you, but look closely at what the clue says, and trust your eyes.`,
    });

  const system = systemPrompt(game, station, solved, hintsShown, secrets);
  let reply = clean(await ask(system));
  if (!leaks(reply, secrets)) return { reply, guarded: false };

  reply = clean(await ask(`${system}\nYour last reply gave the answer away. Say something else that keeps the secret.`));
  if (!leaks(reply, secrets)) return { reply, guarded: true };

  const safe = hintsShown ? station.hints[hintsShown - 1] : "Ha, nice try. My lips are sealed, but read the clue again slowly.";
  return { reply: leaks(safe, secrets) ? "Ha, nice try. My lips are sealed, but read the clue again slowly." : safe, guarded: true };
}

const clean = (s: string) =>
  s
    .replace(/^["“']|["”']$/g, "")
    .replace(/\*[^*]+\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
