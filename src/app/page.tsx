"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { TreasureMap } from "@/components/home/TreasureMap";
import { DIFFICULTIES, MODES, THEMES, type DifficultyId, type ModeId, type ThemeId } from "@/lib/game/options";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<ModeId>("host");
  const [theme, setTheme] = useState<ThemeId>("lost-treasure");
  const [difficulty, setDifficulty] = useState<DifficultyId>("normal");

  // The whole app re-lights when the story theme changes.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const start = () => {
    const params = new URLSearchParams({ mode, theme, difficulty });
    router.push(`/scan?${params}`);
  };

  const chosen = DIFFICULTIES.find((d) => d.id === difficulty)!;

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-9 overflow-x-clip pb-10"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
        paddingRight: "max(1.25rem, env(safe-area-inset-right))",
      }}
    >
      <header className="flex items-center gap-2.5">
        <Lantern />
        <span className="font-display text-xl">Roomscape</span>
      </header>

      <section className="flex flex-col gap-4">
        <TreasureMap />
        <h1 className="font-display text-[2.6rem] leading-[1.02]">Your room is the treasure map.</h1>
        <p className="max-w-[34ch] text-lg leading-relaxed text-pretty text-text-soft">
          Scan a room and Roomscape hides a story of clues in the things around you.
        </p>
      </section>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="mb-3 text-base font-semibold">How do you want to play?</legend>
        {MODES.map((m) => (
          <label
            key={m.id}
            className={clsx(
              "relative flex cursor-pointer gap-4 rounded-3xl border p-4 transition-colors",
              mode === m.id ? "border-lantern bg-night-raised" : "border-ink-line bg-transparent",
            )}
          >
            <input
              type="radio"
              name="mode"
              value={m.id}
              checked={mode === m.id}
              onChange={() => setMode(m.id)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={clsx(
                "mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2",
                mode === m.id ? "border-lantern" : "border-ink-line",
              )}
            >
              {mode === m.id ? <motion.span layoutId="mode-dot" className="size-2.5 rounded-full bg-lantern" /> : null}
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-display text-xl">{m.name}</span>
              <span className="text-sm leading-relaxed text-text-soft">{m.line}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="mb-3 text-base font-semibold">Choose a story</legend>
        <div className="-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {THEMES.map((t) => (
            <label
              key={t.id}
              data-theme={t.id}
              className={clsx(
                "relative flex w-[15.5rem] shrink-0 snap-start cursor-pointer flex-col gap-2 rounded-3xl border p-4",
                "bg-night text-text transition-[border-color,transform]",
                theme === t.id ? "border-lantern" : "border-ink-line",
              )}
              style={{ backgroundImage: "var(--wash)" }}
            >
              <input
                type="radio"
                name="theme"
                value={t.id}
                checked={theme === t.id}
                onChange={() => setTheme(t.id)}
                className="sr-only"
              />
              <span className="flex gap-1.5" aria-hidden>
                <span className="size-3 rounded-full bg-lantern" />
                <span className="size-3 rounded-full bg-tide" />
                <span className="size-3 rounded-full bg-paper" />
              </span>
              <span className="font-display text-lg">{t.name}</span>
              <span className="text-sm leading-relaxed text-text-soft">{t.line}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="mb-3 text-base font-semibold">Difficulty</legend>
        <div className="grid grid-cols-3 rounded-2xl border border-ink-line bg-night-deep p-1">
          {DIFFICULTIES.map((d) => (
            <label key={d.id} className="relative cursor-pointer">
              <input
                type="radio"
                name="difficulty"
                value={d.id}
                checked={difficulty === d.id}
                onChange={() => setDifficulty(d.id)}
                className="peer sr-only"
              />
              {difficulty === d.id ? (
                <motion.span
                  layoutId="difficulty-pill"
                  className="absolute inset-0 rounded-xl bg-night-raised shadow-[0_0_0_1px_var(--ink-line)_inset]"
                  transition={{ type: "spring", stiffness: 500, damping: 36 }}
                />
              ) : null}
              <span
                className={clsx(
                  "relative flex min-h-11 items-center justify-center text-sm font-semibold peer-focus-visible:underline",
                  difficulty === d.id ? "text-text" : "text-text-soft",
                )}
              >
                {d.name}
              </span>
            </label>
          ))}
        </div>
        <p className="text-sm text-text-soft">
          {chosen.stations} clues, about {chosen.minutes}.
        </p>
      </fieldset>

      <div className="flex flex-col gap-3">
        <Button onClick={start} className="min-h-14 w-full text-lg">
          {mode === "host" ? "Scan the room to hide your gift" : "Scan my room"}
        </Button>
        <p className="text-center text-xs text-text-soft">For players 18 and over.</p>
      </div>
    </main>
  );
}

function Lantern() {
  return (
    <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden>
      <path d="M7 3 H15 M11 0 V3" stroke="var(--text-soft)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 7 H18 L16 24 H6 Z" fill="none" stroke="var(--text-soft)" strokeWidth="1.6" strokeLinejoin="round" />
      <ellipse cx="11" cy="15" rx="3.2" ry="5" fill="var(--lantern)">
        <animate attributeName="ry" values="5;4.4;5" dur="2.8s" repeatCount="indefinite" />
      </ellipse>
      <path d="M5 27 H17" stroke="var(--text-soft)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
