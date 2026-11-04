"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { PaperCard } from "@/components/ui/PaperCard";
import { ObjectOutline } from "@/components/game/ObjectOutline";
import { useToast } from "@/components/ui/Toast";
import { fetchGame, hostKeyFor, postJSON } from "@/lib/client/game";
import type { Game } from "@/lib/game/schema";
import type { Station } from "@/lib/game/plan";

const TYPE_LABEL: Record<string, string> = {
  "riddle-hunt": "Riddle",
  "observation-code": "Look closely",
  cipher: "Code",
  logic: "Brain teaser",
  "picture-fragment": "Torn picture",
};
const CHECK_LABEL: Record<Station["check"], string> = {
  "solved-blind": "Solved blind by Muse Spark 1.3",
  code: "Answer checked in code",
  template: "Tested backup clue",
};

export default function HostPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null);

  useEffect(() => {
    fetchGame<Game & { isHost: boolean }>(id)
      .then((g) => {
        if (!g.isHost || !g.plan) throw new Error("Only the host can preview the hunt.");
        document.documentElement.dataset.theme = g.theme;
        setGame(g);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const swap = async (stationId: string) => {
    setSwapping(stationId);
    try {
      const { station } = await postJSON<{ station: Station }>(`/api/games/${id}/build/swap`, { stationId }, hostKeyFor(id));
      setGame((g) => (g ? { ...g, plan: { ...g.plan!, stations: g.plan!.stations.map((s) => (s.id === stationId ? station : s)) } } : g));
      toast.show("Clue swapped.", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Swapping failed.", "error");
    } finally {
      setSwapping(null);
    }
  };

  const link = typeof window === "undefined" ? "" : `${window.location.origin}/game/${id}/play`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: game?.plan?.title ?? "Roomscape", text: "A treasure hunt is waiting for you.", url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast.show("Link copied.", "success");
      }
    } catch {
      /* the share sheet was closed */
    }
  };

  if (error)
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-5">
        <h1 className="font-display text-3xl">Preview is for the host</h1>
        <p className="text-text-soft">{error}</p>
      </main>
    );
  if (!game?.plan) return <main className="min-h-dvh" aria-busy />;

  const plan = game.plan;
  const objectOf = (s: Station) => game.room.objects.find((o) => o.id === s.objectId);
  const gift = game.room.objects.find((o) => o.id === game.host?.prizeObjectId);
  const answerText = (s: Station) => {
    if (s.type === "riddle-hunt" || s.type === "picture-fragment") return `the ${objectOf(s)?.name}`;
    return s.answer;
  };

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 pb-10"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
        paddingRight: "max(1.25rem, env(safe-area-inset-right))",
      }}
    >
      <header className="flex flex-col gap-2">
        <p className="text-sm text-text-soft">Host preview: only you can see this</p>
        <h1 className="font-display text-[2.1rem] leading-tight">{plan.title}</h1>
        <p className="text-text-soft">Read each clue and its answer. Swap any you don’t like, then hand the phone over or send the link.</p>
      </header>

      <ol className="relative flex flex-col gap-4">
        <span className="absolute bottom-6 left-[1.35rem] top-6 border-l-2 border-dashed border-lantern/40" aria-hidden />
        {plan.stations.map((s, i) => {
          const o = objectOf(s);
          const f = o ? game.room.frames[o.frame] : undefined;
          return (
            <motion.li key={s.id} layout className="relative flex gap-3">
              <span className="z-10 mt-1 grid size-11 shrink-0 place-items-center rounded-full border-2 border-lantern bg-night font-mono text-lg font-bold text-lantern">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl border border-ink-line bg-night-raised/70 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-text-soft">
                    {TYPE_LABEL[s.type]} with {s.character.name}
                  </span>
                  <span className="shrink-0 text-xs text-tide">{CHECK_LABEL[s.check]}</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={s.objectId + s.prompt.slice(0, 10)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                    {f && o ? (
                      <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: "16 / 9" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        <ObjectOutline frame={f} objects={[o]} animate={false} />
                      </div>
                    ) : null}
                    <p className="whitespace-pre-line text-[0.95rem] leading-snug">{s.prompt}</p>
                    <p className="text-sm">
                      <span className="font-semibold text-lantern">Answer: </span>
                      {answerText(s)}
                    </p>
                  </motion.div>
                </AnimatePresence>
                <Button variant="ghost" busy={swapping === s.id} onClick={() => swap(s.id)} className="self-start">
                  Swap this clue
                </Button>
              </div>
            </motion.li>
          );
        })}
      </ol>

      <PaperCard tilt={-1}>
        <p className="text-sm font-semibold">The ending tells them</p>
        <p className="mt-1 font-display text-[1.2rem] leading-snug">{plan.reveal}</p>
        {gift ? <p className="mt-2 text-sm">Gift spot: the {gift.name}{game.host?.prizeNote ? `, ${game.host.prizeNote}` : ""}.</p> : null}
      </PaperCard>

      <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 bg-gradient-to-t from-night via-night/95 to-transparent px-5 pt-6 pb-2">
        <Button onClick={() => router.push(`/game/${id}/play`)} className="min-h-14 w-full text-lg">
          Hand the phone to the players
        </Button>
        <Button variant="quiet" onClick={share}>
          Send the players a link
        </Button>
      </div>
    </main>
  );
}
