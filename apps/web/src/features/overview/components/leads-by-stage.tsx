import { formatNumber } from "../format";
import type { LeadStage, StageCount } from "../types";

/** Categorical stage colours — identical in light and dark (same hues as the design). */
const STAGE_META: Record<LeadStage, { label: string; color: string }> = {
  new: { label: "New", color: "#38BDF8" },
  contacted: { label: "Contacted", color: "#FBBF24" },
  interested: { label: "Interested", color: "#F472B6" },
  won: { label: "Won", color: "#4ADE80" },
  lost: { label: "Lost", color: "#94A3B8" },
  do_not_contact: { label: "Do not contact", color: "#F87171" },
};

export function LeadsByStage({ stages, totalLeads }: { stages: StageCount[]; totalLeads: number }) {
  return (
    <section
      className="flex flex-col rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
      aria-labelledby="stage-title"
    >
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 id="stage-title" className="text-base font-medium text-foreground">
          Leads by stage
        </h2>
        <span className="text-xs text-muted-foreground">{formatNumber(totalLeads)} total</span>
      </div>
      <ul className="divide-y divide-border">
        {stages.map(({ stage, count }) => {
          const meta = STAGE_META[stage];
          const pct = totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : "0.0";
          return (
            <li
              key={stage}
              className="group -mx-3 flex cursor-default items-center justify-between rounded-lg px-3 py-3 transition-colors duration-150 last:pb-3 hover:bg-muted/60"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="size-2 rounded-full transition-transform duration-200 group-hover:scale-150"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <span className="text-sm text-foreground">{meta.label}</span>
                <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                  ({pct}%)
                </span>
              </div>
              <span className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                {formatNumber(count)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
