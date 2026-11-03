import Link from "next/link";
import { Bot } from "lucide-react";
import type { ReactNode } from "react";

/** Edit these once and both legal pages update. */
export const LEGAL = {
  product: "AI Sales Agent",
  company: "AI Sales Agent",
  contactEmail: "support@aisalesagent.app",
  updated: "November 3, 2026",
} as const;

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Shared layout for the Terms of Service and Privacy Policy. Uses theme tokens, so it follows light and dark mode. */
export function LegalPage({ title, intro, sections, other }: {
  title: string;
  intro: string;
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2 font-semibold transition-opacity hover:opacity-80">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bot className="size-[18px]" />
            </span>
            {LEGAL.product}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href={other.href} className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {other.label}
            </Link>
            <Link href="/signup" className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-colors hover:bg-primary/85">
              Back to sign up
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 lg:py-14">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {LEGAL.updated}</p>
        <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">{intro}</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-6 flex flex-col gap-0.5 rounded-xl border border-border bg-card p-2 text-sm">
              {sections.map((s, i) => (
                <a key={s.id} href={`#${s.id}`} className="rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary">
                  {i + 1}. {s.title}
                </a>
              ))}
            </nav>
          </aside>
          <div className="flex flex-col gap-8">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-6">
                <h2 className="text-lg font-semibold">
                  {i + 1}. {s.title}
                </h2>
                <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a:hover]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} {LEGAL.company}</span>
          <span className="flex gap-4">
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms of Service</Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy Policy</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
