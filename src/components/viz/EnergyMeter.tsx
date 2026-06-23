import { energyBars, energyTone } from "@/lib/viz";
import type { Track } from "@/lib/library-store";

interface Props {
  track: Pick<Track, "bpm" | "camelot">;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function EnergyMeter({ track, showLabel = false, size = "sm" }: Props) {
  const bars = energyBars(track);
  const tone = energyTone(bars);
  const heights = size === "md" ? [6, 9, 12, 15, 18] : [4, 6, 8, 10, 12];
  const w = size === "md" ? 3 : 2.5;

  return (
    <span
      className="inline-flex items-end gap-[2px] align-middle"
      title={tone.label}
      aria-label={`Énergie ${bars}/5 — ${tone.label}`}
    >
      {heights.map((h, i) => {
        const active = i < bars;
        return (
          <span
            key={i}
            className="rounded-sm transition-colors"
            style={{
              width: w,
              height: h,
              background: active ? tone.color : "var(--surface-elevated)",
              opacity: active ? 1 : 0.5,
            }}
          />
        );
      })}
      {showLabel && (
        <span
          className="ml-1.5 text-[10px] font-medium uppercase tracking-wide"
          style={{ color: tone.color }}
        >
          {tone.label}
        </span>
      )}
    </span>
  );
}
