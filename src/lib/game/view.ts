import type { Game } from "./schema";

/**
 * What a player's phone may see. Answers, hints, the final code, the
 * ending and the room's checked details (which are puzzle answers) stay on
 * the server; the play routes hand them out one step at a time.
 */
export function playerView(game: Game) {
  const { hostKey: _key, host: _host, progress: _progress, plan, room, ...rest } = game;
  void _key;
  void _host;
  void _progress;
  return {
    ...rest,
    room: {
      summary: room.summary,
      frames: room.frames,
      objects: room.objects.map(({ facts: _facts, ...o }) => {
        void _facts;
        return o;
      }),
    },
    plan: plan
      ? {
          title: plan.title,
          intro: plan.intro,
          treasure: plan.treasure,
          scene: plan.scene,
          sceneFrame: plan.sceneFrame,
          designedBy: plan.designedBy,
          codeLength: plan.finalCode.length,
          stations: plan.stations.map((s) => ({
            id: s.id,
            type: s.type,
            title: s.title,
            // A hiding character's portrait would give the answer away; it is revealed when found.
            character: s.type === "riddle-hunt" || s.type === "picture-fragment" ? { ...s.character, art: undefined } : s.character,
            hiding: s.type === "riddle-hunt" || s.type === "picture-fragment",
            prompt: s.prompt,
            statements: s.statements,
            options: s.options,
            image: s.image,
            after: s.after,
            check: s.check,
            // For hunts the object is the answer, so it stays on the server.
            objectId: s.type === "riddle-hunt" || s.type === "picture-fragment" ? undefined : s.objectId,
          })),
        }
      : undefined,
  };
}

export type PlayerGame = ReturnType<typeof playerView>;

/** The host sees everything, to preview and swap stations before handing over. */
export function hostView(game: Game) {
  const { hostKey: _key, ...rest } = game;
  void _key;
  return rest;
}
