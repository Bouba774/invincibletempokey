import { compatBetween } from "@/lib/viz";
import type { Track } from "@/lib/library-store";
import { CheckCheck, Check, Waves, AlertTriangle, X, Minus } from "lucide-react";

interface Props {
  source: Pick<Track, "camelot" | "bpm"> | null;
  target: Pick<Track, "camelot" | "bpm">;
  compact?: boolean;
}

export function CompatibilityBadge({ source, target, compact = false }: Props) {
  const c = compatBetween(source, target);
  const Icon =
    c.tier === "perfect"
      ? CheckCheck
      : c.tier === "great"
        ? Check
        : c.tier === "ok"
          ? Waves
          : c.tier === "risky"
            ? AlertTriangle
            : c.tier === "avoid"
              ? X
              : Minus;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${c.tone.bg} ${c.tone.fg} ${c.tone.ring}`}
      title={c.hint}
    >
      <Icon className="h-3 w-3" />
      {!compact && c.label}
    </span>
  );
}
