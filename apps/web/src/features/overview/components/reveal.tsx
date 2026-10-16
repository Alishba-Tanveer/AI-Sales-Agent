import { cn } from "cn";

/**
 * Fade + slide-up entrance (uses tw-animate-css, already imported in globals.css).
 * Staggered with `delay` (ms). Skipped for people who prefer reduced motion.
 */
export function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 [animation-fill-mode:backwards]",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
