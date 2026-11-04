import { cn } from "cn";
import { TONES } from "@/features/settings/components/settings-ui";

const META: Record<string, { label: string; tone: keyof typeof TONES }> = {
  interested: { label: "Interested", tone: "success" },
  question: { label: "Asked a question", tone: "info" },
  not_interested: { label: "Not interested", tone: "warning" },
  unsubscribe: { label: "Asked to stop", tone: "destructive" },
  out_of_office: { label: "Out of office", tone: "primary" },
  other: { label: "Reply", tone: "primary" },
};

/** What the AI understood an automatically received reply to mean. */
export function IntentBadge({ intent, className }: { intent?: string | null; className?: string }) {
  if (!intent || !META[intent]) return null;
  const { label, tone } = META[intent];
  return <span className={cn("inline-flex items-center rounded-md border px-1.5 py-px text-[10px] font-semibold", TONES[tone].tile, className)} title="Understood by AI from the reply text">{label}</span>;
}
