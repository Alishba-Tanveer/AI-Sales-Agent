"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "cn";

/**
 * Light / Dark segmented switch (next-themes remembers the choice).
 * The active segment is styled with CSS (`dark:` variants) instead of JS state,
 * so there is no hydration mismatch or flicker on first paint.
 */
export function ThemeSwitch() {
  const { setTheme } = useTheme();

  const base =
    "group flex cursor-pointer items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all duration-200 active:scale-95";

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="grid w-full grid-cols-2 gap-1 rounded-lg border border-border bg-card p-0.5"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          base,
          "bg-secondary text-primary shadow-sm dark:bg-transparent dark:text-muted-foreground dark:shadow-none dark:hover:text-foreground",
        )}
      >
        <Sun className="size-4 transition-transform duration-500 motion-safe:group-hover:rotate-90" />
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          base,
          "text-muted-foreground hover:text-foreground dark:bg-secondary dark:text-primary dark:shadow-sm",
        )}
      >
        <Moon className="size-4 transition-transform duration-500 motion-safe:group-hover:-rotate-12" />
        Dark
      </button>
    </div>
  );
}
