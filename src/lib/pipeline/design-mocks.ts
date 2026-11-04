import { toNumber } from "@/lib/game/facts";
import type { Brief, DesignReply, DesignStation } from "./design";

/** A complete, rule-abiding sample design built from the real room list, for mock mode. */
export function mockDesign(brief: Brief): DesignReply {
  const used = new Set<string>();
  const take = (ok: (o: Brief["objects"][number]) => boolean) => {
    const o = brief.objects.find((x) => !used.has(x.id) && ok(x));
    if (o) used.add(o.id);
    return o;
  };
  const voices = ["warm", "creaky", "crisp", "low", "high"] as const;

  const stations: DesignStation[] = brief.types.map((type, i) => {
    const voice = voices[i % voices.length];
    if (type === "riddle-hunt") {
      const o = take((x) => x.reachable)!;
      return {
        type, objectId: o.id, title: "The first light",
        character: { name: "The Night Watch", persona: "A sleepy, poetic keeper of the captain's secret.", greeting: "I am hiding somewhere in this room. Follow the riddle.", voice },
        prompt: "I sleep all day and wake at dusk,\nI stand on one leg and never walk.\nFind me where the shadows start.",
        answer: o.id,
        hints: ["I only work when the sun goes down.", "Look for something tall that gives light.", `It is the ${o.name}: it lights the room at night.`],
      };
    }
    if (type === "observation-code") {
      const o = take((x) => x.facts.some((f) => f.kind === "count" && toNumber(f.value) !== null))!;
      const fact = o.facts.find((f) => f.kind === "count" && toNumber(f.value) !== null)!;
      return {
        type, objectId: o.id, title: "Count like a sailor",
        character: { name: "Bosun Shelf", persona: "A gruff keeper of the ship's log.", greeting: "Count carefully, deckhand. The sea punishes the careless.", voice },
        prompt: `The captain hid a number in plain sight. Go to the ${o.name} and count the ${fact.about.replace(/^number of /i, "")}.`,
        answer: String(toNumber(fact.value)), factAbout: fact.about,
        hints: ["Count slowly and say each one out loud.", `Look closely at the ${o.name}.`, `There are ${toNumber(fact.value)}.`],
      };
    }
    if (type === "picture-fragment") {
      const o = take((x) => x.reachable)!;
      return {
        type, objectId: o.id, title: "A torn corner of the map",
        character: { name: "Marigold", persona: "A cheerful piece of the room who loves being painted.", greeting: "You recognised me! Most people walk right past.", voice },
        prompt: "This scrap was torn from the captain's painted map. Find the place in this room that it shows.",
        answer: o.id,
        hints: ["It is lower than you think.", `It is near the ${o.name}.`, `It shows the ${o.name}.`],
      };
    }
    if (type === "cipher") {
      const o = take(() => true)!;
      const key = brief.objects.find((x) => x.facts.some((f) => f.kind === "count" && (toNumber(f.value) ?? 0) >= 1 && (toNumber(f.value) ?? 0) <= 25))!;
      const fact = key.facts.find((f) => f.kind === "count" && (toNumber(f.value) ?? 0) >= 1)!;
      return {
        type, objectId: o.id, title: "The captain's code",
        character: { name: "Professor Tock", persona: "A fussy, precise keeper of codes.", greeting: "Ciphers are just patience in disguise.", voice },
        prompt: "Inside the ship's log, a single word is written in the captain's private code.",
        answer: "ANCHOR", keyObjectId: key.id, keyFactAbout: fact.about,
        hints: ["Every letter has moved the same number of places forward.", `The number comes from the ${key.name}.`, "Shift each letter back and the word is ANCHOR."],
      };
    }
    const o = take(() => true)!;
    return {
      type, objectId: o.id, title: "Three voices in the dark",
      character: { name: "Captain's Echo", persona: "The captain's voice, still echoing in the room.", greeting: "My crew always argued. One of them never told the truth.", voice },
      prompt: "Three of the captain's crew argue about who moved the final clue. Exactly one of them is lying. Who moved it?",
      statements: ['Marlow says: "Isla moved it."', 'Isla says: "Finn moved it."', 'Finn says: "Isla is lying."'],
      options: ["Marlow", "Isla", "Finn"], answer: "Isla",
      hints: ["Try each sailor as the one who moved it, and count the lies.", "If Finn moved it, two sailors would be lying.", "Isla moved it: then only Isla is lying."],
    };
  });

  return {
    title: brief.mode === "host" ? "A Gift Below Deck" : "The Lantern Map",
    intro: `${brief.touches.player ? `${brief.touches.player}, the` : "The"} captain who lived here hid her last treasure in this very room. The objects around you remember where. Ask them.`,
    treasure: brief.mode === "host" ? "a surprise left just for you" : "the captain's golden compass",
    epilogue: "The lock clicks open and the room goes quiet. The captain would be proud.",
    reveal: brief.prize ? `Look ${brief.prize.note}. The captain left something there for you.` : "The compass was tucked behind the books all along.",
    stations,
  };
}

/** The blind tester agrees with every designed answer in mock mode. */
export function mockBlindSolve(items: { s: DesignStation; index: number }[]) {
  return { answers: items.map(({ s, index }) => ({ index, answer: s.answer })) };
}
