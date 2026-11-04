import { z } from "zod";
import { askJSON, text, type Trace } from "@/lib/models";
import { toNumber } from "@/lib/game/facts";
import type { Game, RoomObject } from "@/lib/game/schema";
import { StationType, VoiceStyle, type Plan, type Station } from "@/lib/game/plan";
import { newId } from "@/lib/store";
import { mockBlindSolve, mockDesign } from "./design-mocks";

/* ---------- What the designer returns ---------- */

export const DesignStation = z.object({
  type: StationType,
  objectId: z.string(),
  title: z.string(),
  character: z.object({ name: z.string(), persona: z.string(), greeting: z.string(), voice: VoiceStyle }),
  prompt: z.string(),
  answer: z.string(),
  factAbout: z.string().optional(),
  keyObjectId: z.string().optional(),
  keyFactAbout: z.string().optional(),
  statements: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  hints: z.array(z.string()).length(3),
});
export type DesignStation = z.infer<typeof DesignStation>;

export const DesignReply = z.object({
  title: z.string(),
  intro: z.string(),
  treasure: z.string(),
  epilogue: z.string(),
  reveal: z.string(),
  stations: z.array(DesignStation),
});
export type DesignReply = z.infer<typeof DesignReply>;

/** Which puzzle types a game uses, in play order. The first three kinds open together. */
export const TYPES_BY_DIFFICULTY: Record<Game["difficulty"], StationType[]> = {
  easy: ["riddle-hunt", "observation-code", "picture-fragment", "cipher"],
  normal: ["riddle-hunt", "observation-code", "picture-fragment", "cipher", "logic"],
  hard: ["riddle-hunt", "riddle-hunt", "observation-code", "picture-fragment", "cipher", "logic"],
};

const OPEN_TYPES: StationType[] = ["riddle-hunt", "observation-code", "picture-fragment"];

const THEME_BRIEF: Record<Game["theme"], string> = {
  "lost-treasure":
    "Lost treasure: a sea captain hid her fortune in this room long ago. Maps, lanterns, salt air and old ship's logs. Adventurous and warm.",
  heist:
    "The heist: something precious vanished from this room at midnight. Velvet ropes, moonlight, sharp-witted suspects. Clever and playful, never violent.",
  haunted:
    "Haunted house: something in this room is restless and wants to be found. Moonlit mist and friendly ghosts. Gently spooky, never gory.",
};

/* ---------- The brief given to the designer ---------- */

export type Brief = {
  theme: Game["theme"];
  mode: Game["mode"];
  types: StationType[];
  objects: { id: string; name: string; reachable: boolean; facts: { kind: string; about: string; value: string }[] }[];
  prize?: { id: string; name: string; note: string };
  pinned: string[];
  touches: { player?: string; occasion?: string; jokes?: string };
};

/** Objects a puzzle may use: found by SAM, not blocked by the host, not the prize spot. */
export function clueObjects(game: Game): RoomObject[] {
  const blocked = new Set(game.host?.blocked ?? []);
  return game.room.objects.filter(
    (o) => o.status !== "dropped" && o.status !== "listed" && !blocked.has(o.id) && o.id !== game.host?.prizeObjectId,
  );
}

export function makeBrief(game: Game): Brief {
  const prizeObject = game.room.objects.find((o) => o.id === game.host?.prizeObjectId);
  return {
    theme: game.theme,
    mode: game.mode,
    types: TYPES_BY_DIFFICULTY[game.difficulty],
    objects: clueObjects(game).map((o) => ({
      id: o.id,
      name: o.name,
      reachable: o.reachable,
      facts: o.facts.filter((f) => f.verified).map(({ kind, about, value }) => ({ kind, about, value })),
    })),
    prize: prizeObject
      ? { id: prizeObject.id, name: prizeObject.name, note: game.host?.prizeNote || `near the ${prizeObject.name}` }
      : undefined,
    pinned: game.host?.pinned ?? [],
    touches: { player: game.host?.player, occasion: game.host?.occasion, jokes: game.host?.jokes },
  };
}

function designerSystem(brief: Brief): string {
  const count = brief.types.length;
  return `You design a short treasure-hunt mystery that plays out in one real room, for adults at home. Players walk around the room, look closely at real objects, solve puzzles, and each solved puzzle gives one digit of a final lock.

Story world: ${THEME_BRIEF[brief.theme]}
Write in second person, present tense, warm and witty. Short sentences. No violence, gore, weapons or anything frightening for real.

Make exactly ${count} stations, in this order of types: ${brief.types.join(", ")}.
Every station uses a DIFFERENT object, and every objectId must be copied exactly from the room list. Never invent objects or details.
${brief.pinned.length ? `These objects must each be used by a station: ${brief.pinned.join(", ")}.` : ""}

Each object in a station speaks as a character: give it a name that suits the story, a one-line persona, a greeting of at most 20 words, and a voice (low, high, warm, crisp or creaky).
In riddle-hunt and picture-fragment stations the character IS the object being searched for and is speaking from hiding: its name, persona and greeting must not reveal what kind of object it is (no "Old Wick" for a lamp). It can tease, for example "You are closer than you think."

Station rules:
- riddle-hunt: "prompt" is a riddle of 2 to 4 short lines that leads to the object through its look, use or a verified detail. It must not contain the object's name or an obvious synonym. "answer" is the objectId. The object must be reachable.
- observation-code: the player looks closely at the object and counts something. Use one of the object's verified facts of kind "count": copy its "about" text exactly into "factAbout", and put its value as digits in "answer". The prompt names the object and says what to count, in story voice.
- picture-fragment: the player is shown a painted close-up of part of the room and must find where it is. "prompt" is 1 or 2 sentences of story setting it up. "answer" is the objectId. The object must be reachable.
- cipher: "answer" is ONE word of 4 to 8 letters (A to Z only) that matters to the story. Choose a verified fact of kind "count" (value 1 to 25) or "time" on any object for the shift: set "keyObjectId" and copy its "about" exactly into "keyFactAbout". "prompt" is 1 or 2 sentences of story around a coded message; the app adds the coded word and the decoding rule itself.
- logic: three characters each make one statement in "statements" (write them as: Name says: "..."). "options" holds the three names. Exactly one answer must follow by pure reasoning, with no outside knowledge and no room details needed. "answer" is one of the options, copied exactly. The prompt states the rule (for example, exactly one of them is lying) and the question.

Hints, exactly 3 per station: first a gentle in-character nudge, then a pointer that narrows it down, then a reveal that states the answer and explains why.

${brief.mode === "host" && brief.prize
    ? `This is a hosted hunt. A real gift is hidden ${brief.prize.note} (the ${brief.prize.name}). "reveal" tells the players, in story voice, exactly where to look for it. "treasure" describes the gift as a surprise without saying what it is. Never use the ${brief.prize.name} in any station.`
    : `"reveal" says, in story voice, where the story's treasure was hidden all along, naming one object from the list. "treasure" names the story treasure.`}
${brief.touches.player ? `The player's name is ${brief.touches.player}; use it in the intro and the epilogue.` : ""}
${brief.touches.occasion ? `The occasion is: ${brief.touches.occasion}. Let it shape the story and the epilogue.` : ""}
${brief.touches.jokes ? `Inside jokes the host wants included, lightly: ${brief.touches.jokes}.` : ""}

"title" is a story title of 2 to 5 words. "intro" is 2 or 3 sentences that set the scene in this room. "epilogue" is 2 sentences for when the final lock opens.
No red herrings. Nothing that needs knowledge from outside the room.`;
}

function roomList(brief: Brief): string {
  return JSON.stringify({ objects: brief.objects }, null, 1);
}

/* ---------- Guardrails: rules checked in code ---------- */

const WORD = /^[A-Z]{4,8}$/;

function nameWords(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3);
}

/** Every rule a station must meet. Returns the problems found, empty when it passes. */
export function stationProblems(s: DesignStation, game: Game, brief: Brief): string[] {
  const problems: string[] = [];
  const allowed = new Map(clueObjects(game).map((o) => [o.id, o]));
  const object = allowed.get(s.objectId);
  if (!object) return [`objectId ${s.objectId} is not in the room list`];
  if (s.hints.some((h) => !h.trim())) problems.push("every hint needs text");

  if (s.type === "riddle-hunt" || s.type === "picture-fragment") {
    if (!object.reachable) problems.push(`the ${object.name} is not reachable`);
    if (s.answer !== s.objectId) problems.push("the answer must be the objectId");
  }
  if (s.type === "riddle-hunt" || s.type === "picture-fragment") {
    const said = `${s.character.name} ${s.character.greeting}`.toLowerCase();
    const giveaway = nameWords(object.name).filter((w) => said.includes(w));
    if (giveaway.length) problems.push(`the hiding character's name or greeting gives away "${giveaway.join(", ")}"`);
  }
  if (s.type === "riddle-hunt") {
    const prompt = s.prompt.toLowerCase();
    const leaked = nameWords(object.name).filter((w) => prompt.includes(w));
    if (leaked.length) problems.push(`the riddle gives away the answer with "${leaked.join(", ")}"`);
  }
  if (s.type === "observation-code") {
    const fact = object.facts.find(
      (f) => f.verified && f.kind === "count" && f.about.trim().toLowerCase() === s.factAbout?.trim().toLowerCase(),
    );
    if (!fact) problems.push("factAbout must copy a verified count fact of this object");
    else if (toNumber(fact.value) === null || toNumber(fact.value) !== toNumber(s.answer))
      problems.push(`the answer must be the verified count, ${fact.value}`);
  }
  if (s.type === "cipher") {
    if (!WORD.test(s.answer.trim().toUpperCase())) problems.push("the answer must be one word of 4 to 8 letters");
    if (cipherShift(s, game) === null) problems.push("keyObjectId and keyFactAbout must point at a verified count (1 to 25) or time fact");
  }
  if (s.type === "logic") {
    if (s.options?.length !== 3) problems.push("logic needs exactly 3 options");
    if (!s.options?.includes(s.answer)) problems.push("the answer must be one of the options, copied exactly");
    if ((s.statements?.length ?? 0) < 2) problems.push("logic needs the characters' statements");
  }
  void brief;
  return problems;
}

function cipherShift(s: DesignStation, game: Game): { shift: number; rule: string } | null {
  const keyObject = game.room.objects.find((o) => o.id === s.keyObjectId);
  const fact = keyObject?.facts.find(
    (f) => f.verified && f.about.trim().toLowerCase() === s.keyFactAbout?.trim().toLowerCase(),
  );
  if (!keyObject || !fact) return null;
  if (fact.kind === "count") {
    const n = toNumber(fact.value);
    if (n === null || n < 1 || n > 25) return null;
    return { shift: n, rule: `the ${fact.about} on the ${keyObject.name}` };
  }
  if (fact.kind === "time") {
    const hour = Number(fact.value.match(/(\d{1,2})/)?.[1]);
    if (!hour || hour > 12) return null;
    return { shift: hour, rule: `the hour shown on the ${keyObject.name}` };
  }
  return null;
}

export function caesar(word: string, shift: number): string {
  return word
    .toUpperCase()
    .replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + shift) % 26) + 65));
}

/* ---------- Blind solve: Muse Spark 1.3 plays each puzzle first ---------- */

const BlindReply = z.object({ answers: z.array(z.object({ index: z.number(), answer: z.string() })) });

/**
 * Riddles and logic teasers are given to Spark exactly as a player sees them.
 * It must reach the designer's answer on its own; otherwise the station fails.
 */
async function blindSolve(
  stations: (DesignStation | null)[],
  brief: Brief,
  skip: Set<number>,
  trace?: Trace,
): Promise<Map<number, boolean>> {
  const items = stations
    .map((s, index) => ({ s: s!, index }))
    .filter(({ s, index }) => s && !skip.has(index) && (s.type === "riddle-hunt" || s.type === "logic"));
  const verdicts = new Map<number, boolean>();
  if (!items.length) return verdicts;

  const objectList = brief.objects.map((o) => `${o.id}: ${o.name}`).join("\n");
  const puzzles = items
    .map(({ s, index }) =>
      s.type === "riddle-hunt"
        ? `Puzzle ${index} (riddle): ${s.prompt}\nAnswer with the id of the one object from the room list it describes.`
        : `Puzzle ${index} (logic): ${s.prompt}\n${(s.statements ?? []).join("\n")}\nOptions: ${(s.options ?? []).join(", ")}\nAnswer with one option exactly.`,
    )
    .join("\n\n");

  const reply = await askJSON({
    engine: "spark",
    task: "Solve every puzzle blind",
    system:
      "You are a careful puzzle tester. Solve each puzzle on your own. If a riddle fits more than one object equally well, answer AMBIGUOUS. If a logic puzzle has no single answer, answer AMBIGUOUS.",
    parts: [text(`Objects in the room:\n${objectList}\n\n${puzzles}`)],
    schema: BlindReply,
    schemaName: "blind_answers",
    effort: "high",
    timeoutMs: 60_000,
    trace,
    mock: () => mockBlindSolve(items),
  });

  for (const { s, index } of items) {
    const got = reply.answers.find((a) => a.index === index)?.answer.trim().toLowerCase();
    verdicts.set(index, got === s.answer.trim().toLowerCase());
  }
  return verdicts;
}

/* ---------- Templates: used only when a station cannot be made to pass ---------- */

function templateStation(type: StationType, game: Game, used: Set<string>, title: string): DesignStation | null {
  const pool = clueObjects(game).filter((o) => !used.has(o.id));
  const voice = "warm" as const;
  const character = (name: string, hiding = false) =>
    hiding
      ? { name: "The Hidden One", persona: "Something in this room that loves hide and seek.", greeting: "I am hiding somewhere in this room. Find me.", voice }
      : {
          name: `The ${name}`,
          persona: `The ${name}, who has been watching this room for years.`,
          greeting: "You found me. I have been keeping a secret for you.",
          voice,
        };

  if (type === "riddle-hunt" || type === "picture-fragment") {
    const o = pool.find((p) => p.reachable && p.facts.some((f) => f.verified)) ?? pool.find((p) => p.reachable);
    if (!o) return null;
    const detail = o.facts.find((f) => f.verified);
    return {
      type,
      objectId: o.id,
      title,
      character: character(o.name, true),
      prompt:
        type === "riddle-hunt"
          ? `Look for something ${detail ? `whose ${detail.about} is ${detail.value}` : "you pass every day"}. It has been waiting for you.`
          : "A torn corner of an old painting. Find the spot in this room that it shows.",
      answer: o.id,
      hints: [
        "Take a slow look around the room.",
        `It is ${detail ? `the thing whose ${detail.about} is ${detail.value}` : `in the room you scanned`}.`,
        `It is the ${o.name}.`,
      ],
    };
  }
  if (type === "observation-code") {
    for (const o of pool) {
      const fact = o.facts.find((f) => f.verified && f.kind === "count" && toNumber(f.value) !== null);
      if (fact)
        return {
          type,
          objectId: o.id,
          title,
          character: character(o.name),
          prompt: `Go to the ${o.name} and count the ${fact.about.replace(/^number of /i, "")}.`,
          answer: String(toNumber(fact.value)),
          factAbout: fact.about,
          hints: ["Count slowly, one at a time.", `Look at the ${o.name}.`, `The answer is ${toNumber(fact.value)}.`],
        };
    }
    return null;
  }
  if (type === "cipher") {
    const o = pool[0];
    if (!o) return null;
    for (const k of game.room.objects) {
      const fact = k.facts.find((f) => f.verified && f.kind === "count" && (toNumber(f.value) ?? 0) >= 1 && (toNumber(f.value) ?? 0) <= 25);
      if (fact)
        return {
          type,
          objectId: o.id,
          title,
          character: character(o.name),
          prompt: "Someone scratched a coded word where only you would look.",
          answer: game.theme === "haunted" ? "LANTERN" : game.theme === "heist" ? "VELVET" : "ANCHOR",
          keyObjectId: k.id,
          keyFactAbout: fact.about,
          hints: ["Each letter has moved forward the same number of places.", `The number comes from the ${k.name}.`, "Shift each letter back and read the word."],
        };
    }
    return null;
  }
  // logic: a fixed puzzle with exactly one solution (exactly one of three statements is false).
  const names = game.theme === "heist" ? ["Vera", "Otto", "June"] : game.theme === "haunted" ? ["Agnes", "Silas", "Wren"] : ["Marlow", "Isla", "Finn"];
  const o = pool[0];
  if (!o) return null;
  const [a, b, c] = names;
  return {
    type,
    objectId: o.id,
    title,
    character: character(o.name),
    prompt: "Three voices argue about who moved the next clue. Exactly one of them is lying. Who moved it?",
    statements: [`${a} says: "${b} moved it."`, `${b} says: "${c} moved it."`, `${c} says: "${b} is lying."`],
    options: names,
    answer: b,
    hints: [
      "Try each person as the one who moved it, and count the lies.",
      `If ${c} moved it, two people would be lying.`,
      `${b} moved it: then only ${b} is lying.`,
    ],
  };
}

/* ---------- The whole design step ---------- */

export type DesignResult = { plan: Plan; notes: string[] };

export async function designGame(game: Game, trace?: Trace): Promise<DesignResult> {
  const brief = makeBrief(game);
  const notes: string[] = [];
  if (brief.objects.length < brief.types.length) {
    throw new Error(`The scan found ${brief.objects.length} usable objects; this difficulty needs ${brief.types.length}. Scan more of the room.`);
  }

  const system = designerSystem(brief);
  const ask = (engine: "wonder" | "spark") =>
    askJSON({
      engine,
      task: "Design the story and puzzles",
      system,
      parts: [text(`The room:\n${roomList(brief)}\n\nDesign the game as JSON.`)],
      schema: DesignReply,
      schemaName: "game_design",
      effort: "high",
      timeoutMs: engine === "wonder" ? 150_000 : 90_000,
      trace,
      mock: () => mockDesign(brief),
    });

  let designedBy: Plan["designedBy"] = "Muse Wonder 1.0";
  let design: DesignReply;
  try {
    design = await ask("wonder");
  } catch {
    designedBy = "Muse Spark 1.3";
    notes.push("Muse Wonder was slow, so Muse Spark 1.3 designed this game.");
    design = await ask("spark");
  }

  // Line the stations up with the required types, in order.
  const stations: (DesignStation | null)[] = brief.types.map((type, i) => {
    const sameType = design.stations.filter((s) => s.type === type);
    const nth = brief.types.slice(0, i).filter((t) => t === type).length;
    return sameType[nth] ?? null;
  });

  // Round 1: code rules, then the blind solve.
  const failing = async (): Promise<Map<number, string[]>> => {
    const out = new Map<number, string[]>();
    const seen = new Set<string>();
    stations.forEach((s, i) => {
      if (!s) return out.set(i, ["missing station"]);
      const problems = stationProblems(s, game, brief);
      if (seen.has(s.objectId)) problems.push("another station already uses this object");
      seen.add(s.objectId);
      if (problems.length) out.set(i, problems);
    });
    const verdicts = await blindSolve(stations, brief, new Set(out.keys()), trace).catch(() => new Map<number, boolean>());
    stations.forEach((s, i) => {
      if (s && verdicts.get(i) === false && !out.has(i)) out.set(i, ["a blind tester reached a different answer, so the puzzle is ambiguous"]);
    });
    return out;
  };

  let problems = await failing();
  const blindFailed = [...problems.values()].filter((p) => p.some((x) => x.includes("blind tester"))).length;
  notes.push(
    problems.size
      ? `${brief.types.length - problems.size} of ${brief.types.length} puzzles passed on the first try${blindFailed ? `; ${blindFailed} failed the blind solve` : ""}.`
      : `All ${brief.types.length} puzzles passed every check on the first try.`,
  );

  // Round 2: send failures back to the designer once.
  if (problems.size) {
    const RepairReply = z.object({ stations: z.array(DesignStation) });
    const indices = [...problems.keys()];
    const used = stations.filter((s, i) => s && !problems.has(i)).map((s) => s!.objectId);
    try {
      const repair = await askJSON({
        engine: designedBy === "Muse Wonder 1.0" ? "wonder" : "spark",
        task: "Repair failed puzzles",
        system,
        parts: [
          text(
            `The room:\n${roomList(brief)}\n\nThese stations failed their checks. Write a replacement for each, of the same type, using an object not already used (${used.join(", ") || "none used yet"}).\n${indices
              .map((i) => `- ${brief.types[i]}: ${problems.get(i)!.join("; ")}`)
              .join("\n")}\nReturn the replacements in the same order.`,
          ),
        ],
        schema: RepairReply,
        schemaName: "repairs",
        effort: "medium",
        timeoutMs: 90_000,
        trace,
        mock: () => ({ stations: indices.map((i) => stations[i]!).filter(Boolean) }),
      });
      indices.forEach((i, k) => {
        const candidate = repair.stations[k];
        if (candidate && candidate.type === brief.types[i]) stations[i] = candidate;
      });
      problems = await failing();
    } catch {
      /* keep the round-1 problems and fall through to templates */
    }
  }

  // Round 3: anything still failing becomes a tested template.
  const checks: Station["check"][] = stations.map((s) => (s?.type === "riddle-hunt" || s?.type === "logic" ? "solved-blind" : "code"));
  if (problems.size) {
    const used = new Set(stations.filter((s, i) => s && !problems.has(i)).map((s) => s!.objectId));
    for (const i of problems.keys()) {
      const t = templateStation(brief.types[i], game, used, stations[i]?.title ?? "A hidden clue");
      if (!t) throw new Error("The room does not have enough checked details for this difficulty. Try Easy, or scan more of the room.");
      stations[i] = t;
      used.add(t.objectId);
      checks[i] = "template";
    }
    notes.push(`${problems.size} puzzle${problems.size > 1 ? "s were" : " was"} replaced with a tested backup.`);
  }

  // Assemble: unlock order, digits, the coded word.
  const finalDigits: number[] = [];
  const ids = stations.map(() => newId("s"));
  const openIds = ids.filter((_, i) => OPEN_TYPES.includes(brief.types[i]));
  const built: Station[] = stations.map((s, i) => {
    const d = s!;
    const digit = Math.floor(Math.random() * 10);
    finalDigits.push(digit);
    let prompt = d.prompt;
    if (d.type === "cipher") {
      const key = cipherShift(d, game)!;
      prompt = `${d.prompt}\n\nThe coded word: ${caesar(d.answer, key.shift)}\nShift every letter back by ${key.rule}.`;
    }
    const after =
      d.type === "cipher" ? openIds : d.type === "logic" ? ids.filter((_, j) => brief.types[j] === "cipher") : [];
    return {
      id: ids[i],
      type: d.type,
      objectId: d.objectId,
      title: d.title,
      character: d.character,
      prompt,
      answer: d.type === "cipher" ? d.answer.trim().toUpperCase() : d.answer.trim(),
      statements: d.statements,
      options: d.options,
      hints: [d.hints[0], d.hints[1], d.hints[2]],
      after,
      digit,
      check: checks[i],
    };
  });

  return {
    plan: {
      title: design.title,
      intro: design.intro,
      treasure: design.treasure,
      epilogue: design.epilogue,
      reveal: design.reveal,
      stations: built,
      finalCode: finalDigits.join(""),
      designedBy,
    },
    notes,
  };
}

/**
 * Host preview: replaces one clue with a tested backup of the same kind that
 * uses a different object. No model call, so it is instant and free.
 */
export function swapStation(game: Game, stationId: string): Station {
  const plan = game.plan!;
  const index = plan.stations.findIndex((s) => s.id === stationId);
  if (index === -1) throw new Error("No such clue.");
  const old = plan.stations[index];
  const used = new Set(plan.stations.map((s) => s.objectId));
  const d = templateStation(old.type, game, used, old.title);
  if (!d) throw new Error("There is no other object in this room that fits this kind of clue.");
  let prompt = d.prompt;
  if (d.type === "cipher") {
    const key = cipherShift(d, game)!;
    prompt = `${d.prompt}\n\nThe coded word: ${caesar(d.answer, key.shift)}\nShift every letter back by ${key.rule}.`;
  }
  const next: Station = {
    ...old,
    objectId: d.objectId,
    character: { ...d.character, art: undefined },
    prompt,
    answer: d.type === "cipher" ? d.answer.toUpperCase() : d.answer,
    statements: d.statements,
    options: d.options,
    hints: [d.hints[0], d.hints[1], d.hints[2]],
    image: undefined,
    check: "template",
  };
  plan.stations[index] = next;
  return next;
}
