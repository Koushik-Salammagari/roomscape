"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { ObjectOutline } from "@/components/game/ObjectOutline";
import { useToast } from "@/components/ui/Toast";
import { fetchGame, hostKeyFor, postJSON } from "@/lib/client/game";
import type { Game, RoomObject } from "@/lib/game/schema";

type Tool = "gift" | "pin" | "block";

const TOOLS: { id: Tool; name: string; line: string; color: string }[] = [
  { id: "gift", name: "Gift spot", line: "Tap where the gift is hidden. The last clue leads there.", color: "var(--lantern)" },
  { id: "pin", name: "Must use", line: "Tap up to three things you want clues on.", color: "var(--tide)" },
  { id: "block", name: "Don’t use", line: "Tap anything players should leave alone.", color: "var(--danger)" },
];

export default function HostSetup({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [tool, setTool] = useState<Tool>("gift");
  const [gift, setGift] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [pinned, setPinned] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [player, setPlayer] = useState("");
  const [occasion, setOccasion] = useState("");
  const [jokes, setJokes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hostKeyFor(id)) {
      setError("Only the phone that scanned this room can set up the hunt.");
      return;
    }
    fetchGame<Game & { isHost: boolean }>(id)
      .then((g) => {
        document.documentElement.dataset.theme = g.theme;
        setGame(g);
        if (g.host) {
          setGift(g.host.prizeObjectId);
          setNote(g.host.prizeNote ?? "");
          setPinned(g.host.pinned);
          setBlocked(g.host.blocked);
          setPlayer(g.host.player ?? "");
          setOccasion(g.host.occasion ?? "");
          setJokes(g.host.jokes ?? "");
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const usable = useMemo(() => game?.room.objects.filter((o) => o.status !== "dropped") ?? [], [game]);
  const nameOf = (oid?: string) => usable.find((o) => o.id === oid)?.name;

  const colors = useMemo(() => {
    const c: Record<string, string> = {};
    for (const o of usable) c[o.id] = "var(--text-soft)";
    for (const p of pinned) c[p] = "var(--tide)";
    for (const b of blocked) c[b] = "var(--danger)";
    if (gift) c[gift] = "var(--lantern)";
    return c;
  }, [usable, pinned, blocked, gift]);

  const apply = (o: RoomObject) => {
    navigator.vibrate?.(10);
    const drop = (list: string[]) => list.filter((x) => x !== o.id);
    if (tool === "gift") {
      setGift((g) => (g === o.id ? undefined : o.id));
      setPinned(drop);
      setBlocked(drop);
      if (!note) setNote(`near the ${o.name}`);
    } else if (tool === "pin") {
      if (gift === o.id) return toast.show("The gift spot can’t also hold a clue.");
      setBlocked(drop);
      setPinned((p) => (p.includes(o.id) ? drop(p) : p.length >= 3 ? (toast.show("Pick up to three."), p) : [...p, o.id]));
    } else {
      if (gift === o.id) setGift(undefined);
      setPinned(drop);
      setBlocked((b) => (b.includes(o.id) ? drop(b) : [...b, o.id]));
    }
  };

  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!game) return;
    const f = game.room.frames[frame];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * f.width;
    const y = ((e.clientY - rect.top) / rect.height) * f.height;
    const hits = usable
      .filter((o) => o.frame === frame && x >= o.box.left && x <= o.box.right && y >= o.box.top && y <= o.box.bottom)
      .sort((a, b) => (a.box.right - a.box.left) * (a.box.bottom - a.box.top) - (b.box.right - b.box.left) * (b.box.bottom - b.box.top));
    if (hits[0]) apply(hits[0]);
  };

  const save = async () => {
    if (!gift) {
      setTool("gift");
      return toast.show("Tap where the gift is hidden first.");
    }
    setSaving(true);
    try {
      await postJSON(
        `/api/games/${id}/host`,
        { prizeObjectId: gift, prizeNote: note.trim() || `near the ${nameOf(gift)}`, pinned, blocked, player: player.trim() || undefined, occasion: occasion.trim() || undefined, jokes: jokes.trim() || undefined },
        hostKeyFor(id),
      );
      router.push(`/game/${id}/build`);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Saving failed. Try again.", "error");
      setSaving(false);
    }
  };

  if (error)
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-5">
        <h1 className="font-display text-3xl">Setup is for the host</h1>
        <p className="text-text-soft">{error}</p>
      </main>
    );
  if (!game) return <main className="min-h-dvh" aria-busy />;

  const f = game.room.frames[frame];
  const active = TOOLS.find((t) => t.id === tool)!;

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
        <p className="text-sm text-text-soft">Host a hunt</p>
        <h1 className="font-display text-[2.1rem] leading-tight">Hide your gift, then show us where</h1>
        <p className="text-text-soft">Put the gift in its spot now. Players won’t see any of this screen.</p>
      </header>

      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="What tapping does">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={tool === t.id}
            onClick={() => setTool(t.id)}
            className={clsx("flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-2 text-sm font-semibold", tool === t.id ? "bg-night-raised" : "border-ink-line text-text-soft")}
            style={tool === t.id ? { borderColor: t.color } : undefined}
          >
            <span className="size-2.5 rounded-full" style={{ background: t.color }} aria-hidden />
            {t.name}
          </button>
        ))}
      </div>
      <p className="-mt-3 text-sm text-text-soft">{active.line}</p>

      <div className="flex flex-col gap-3">
        <div
          className="relative w-full cursor-pointer overflow-hidden rounded-3xl border border-ink-line"
          style={{ aspectRatio: `${f.width} / ${f.height}` }}
          onClick={tap}
          role="button"
          aria-label="Tap an outlined object"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.url} alt={`Room photo ${frame + 1}`} className="absolute inset-0 h-full w-full select-none" draggable={false} />
          <ObjectOutline frame={f} objects={usable.filter((o) => o.frame === frame)} colors={colors} muted={blocked} showLabels animate={false} />
        </div>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {game.room.frames.map((fr, i) => (
            <button
              key={fr.id}
              type="button"
              onClick={() => setFrame(i)}
              className={clsx("relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2", i === frame ? "border-lantern" : "border-ink-line")}
              aria-label={`Show room photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fr.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-3xl border border-ink-line bg-night-raised/60 p-4">
        <Row color="var(--lantern)" label="Gift spot" value={nameOf(gift) ?? "Not chosen yet"} />
        {gift ? (
          <div className="flex flex-col gap-1.5 pl-5">
            <label htmlFor="gift-note" className="text-sm text-text-soft">
              Where exactly? This is what the ending tells the players.
            </label>
            <input id="gift-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="under the left cushion" className="min-h-12 rounded-2xl border border-ink-line bg-night-deep px-4" />
          </div>
        ) : null}
        <Row color="var(--tide)" label="Must use" value={pinned.map(nameOf).join(", ") || "Roomscape chooses"} />
        <Row color="var(--danger)" label="Don’t use" value={blocked.map(nameOf).join(", ") || "Nothing blocked"} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl">Make it personal</h2>
        <Field id="player" label="Who is playing?" value={player} onChange={setPlayer} placeholder="Maya" />
        <Field id="occasion" label="What’s the occasion?" value={occasion} onChange={setOccasion} placeholder="Our first anniversary" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="jokes" className="text-sm font-semibold">
            Inside jokes the story can mention
          </label>
          <textarea id="jokes" value={jokes} onChange={(e) => setJokes(e.target.value)} rows={3} placeholder="The burnt pancakes. The cat who hates Mondays." className="rounded-2xl border border-ink-line bg-night-deep px-4 py-3" />
        </div>
      </section>

      <motion.div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-night via-night/95 to-transparent px-5 pt-6 pb-2">
        <Button onClick={save} busy={saving} className="min-h-14 w-full text-lg">
          Write the hunt
        </Button>
      </motion.div>
    </main>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <span className="w-20 shrink-0 font-semibold">{label}</span>
      <span className="min-w-0 text-text-soft">{value}</span>
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-12 rounded-2xl border border-ink-line bg-night-deep px-4" />
    </div>
  );
}
