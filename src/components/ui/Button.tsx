"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import clsx from "clsx";

type Variant = "primary" | "quiet" | "ghost";

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: Variant;
  busy?: boolean;
  children: React.ReactNode;
};

const styles: Record<Variant, string> = {
  primary:
    "bg-lantern text-night font-bold shadow-[0_0_0_1px_var(--lantern-glow)_inset,0_10px_30px_-10px_var(--lantern)]",
  quiet: "bg-night-raised text-text border border-ink-line",
  ghost: "bg-transparent text-text-soft underline underline-offset-4 decoration-ink-line",
};

export function Button({ variant = "primary", busy, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={clsx(
        "relative inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 text-base",
        "transition-opacity disabled:opacity-50",
        styles[variant],
        variant === "ghost" && "min-h-10 px-2",
        className,
      )}
      {...rest}
    >
      {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : null}
      {children}
    </motion.button>
  );
}
