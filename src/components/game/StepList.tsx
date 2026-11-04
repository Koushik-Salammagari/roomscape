import clsx from "clsx";

export type StepState = "waiting" | "active" | "done" | "failed";
export type Step = { id: string; label: string; model: string; state: StepState; note?: string };

/** The live progress list that names the Meta model behind each step. */
export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-3.5">
      {steps.map((s) => (
        <li key={s.id} className="flex items-start gap-3">
          <span
            className={clsx(
              "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2",
              s.state === "done" && "border-tide bg-tide text-night",
              s.state === "active" && "border-lantern",
              s.state === "waiting" && "border-ink-line",
              s.state === "failed" && "border-danger",
            )}
            aria-hidden
          >
            {s.state === "done" ? (
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path d="M3 7.5l2.5 2.5L11 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            ) : s.state === "active" ? (
              <span className="size-2.5 animate-ping rounded-full bg-lantern" />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={clsx("font-semibold", s.state === "waiting" && "text-text-soft")}>{s.label}</span>
            <span className="text-xs text-text-soft">{s.model}</span>
            {s.note ? <span className="mt-1 text-sm text-text-soft">{s.note}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
