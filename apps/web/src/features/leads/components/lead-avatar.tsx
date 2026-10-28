import { cn } from "cn";
import { TONES, initials, type Tone } from "@/features/settings/components/settings-ui";

/** Theme accent colours only. Red is kept for danger and purple is left out. */
const AVATAR_TONES: Tone[] = ["info", "warning", "success", "primary"];

const SIZES = { sm: "size-9 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg" } as const;

const hash = (key: string) => { let h = 7; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0; return h; };

/** A person keeps their colour. If the person right above would match, this one moves to the next colour. */
export function avatarTone(id: string, prevId?: string): Tone {
  const t = hash(id) % AVATAR_TONES.length;
  const p = prevId === undefined ? -1 : hash(prevId) % AVATAR_TONES.length;
  return AVATAR_TONES[t === p ? (t + 1) % AVATAR_TONES.length : t];
}

export function LeadAvatar({ name, id, prevId, size = "sm", className }: { name: string; id: string; prevId?: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={cn("flex aspect-square shrink-0 grow-0 items-center justify-center rounded-full border font-semibold transition-transform duration-200 group-hover:scale-105", SIZES[size], TONES[avatarTone(id, prevId)].tile, className)} aria-hidden>
      {initials(name)}
    </span>
  );
}
