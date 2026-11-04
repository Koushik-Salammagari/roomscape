import clsx from "clsx";

type PaperCardProps = {
  children: React.ReactNode;
  className?: string;
  /** Slight rotation in degrees, so stacked clues look hand-placed. */
  tilt?: number;
};

/** A paper clue card. Paper is reserved for things the story hands you. */
export function PaperCard({ children, className, tilt = 0 }: PaperCardProps) {
  return (
    <div
      className={clsx(
        "relative rounded-[6px] bg-paper px-5 py-4 text-paper-ink",
        "shadow-[0_1px_0_rgba(255,255,255,.4)_inset,0_18px_40px_-18px_rgba(0,0,0,.7)]",
        className,
      )}
      style={{
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        backgroundImage:
          "radial-gradient(140% 90% at 0% 0%, rgba(255,255,255,.35), transparent 55%), radial-gradient(120% 80% at 100% 100%, rgba(120,90,40,.18), transparent 60%)",
      }}
    >
      {children}
    </div>
  );
}
