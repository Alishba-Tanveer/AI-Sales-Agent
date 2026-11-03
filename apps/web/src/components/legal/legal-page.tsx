import type { ReactNode } from "react";
import { Brand } from "@/components/auth/auth-shell";
import { Backdrop } from "@/components/auth/backdrop";
import { BackButton } from "@/components/legal/back-button";

export const LEGAL = {
  product: "AI Sales Agent",
  updated: "November 3, 2026",
} as const;

export type LegalSection = { title: string; body: ReactNode };

// Layout lives in plain CSS (not Tailwind classes) so the width and the two columns always apply:
// - card is 70% of the screen width, centered (full width on phones)
// - sections flow into two columns that the browser balances to the same height
const css = `
.legal-card{width:100%}
.legal-cols{column-count:1}
.legal-cols section{break-inside:avoid;margin-bottom:20px}
@media (min-width:768px){
  .legal-card{width:70vw}
  .legal-cols{column-count:2;column-gap:56px;column-fill:balance}
}
`;

/** Simple read-only page for the Terms of Service and Privacy Policy, on the same gradient backdrop as sign up. */
export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center p-4">
      <style>{css}</style>
      <Backdrop />
      <Brand />
      <div className="legal-card relative overflow-hidden rounded-xl border border-[#232A3B] bg-[#111623] p-6 shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#818CF8] to-[#C084FC]" />
        <div className="flex items-start justify-between gap-4 border-b border-[#232A3B] pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#E5E7EB]">{title}</h1>
            <p className="mt-0.5 text-[11px] text-[#94A3B8]">Last updated {LEGAL.updated}</p>
          </div>
          <BackButton />
        </div>
        <div className="legal-cols mt-5">
          {sections.map((s, i) => (
            <section key={s.title}>
              <h2 className="text-[13px] font-semibold text-[#E5E7EB]">{i + 1}. {s.title}</h2>
              <div className="mt-1 space-y-1.5 text-xs leading-relaxed text-[#94A3B8] [&_strong]:text-[#E5E7EB]">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
