import { useMemo } from "react";
import { useLibraryStore } from "@/lib/library-store";
import {
  computeStats,
  formatTotalDuration,
  camelotTone,
  energyTone,
} from "@/lib/viz";
import { CamelotBadge } from "./CamelotBadge";
import { BarChart3, Clock, Gauge, Music, Sparkles } from "lucide-react";

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="text-[var(--primary-glow)]">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

export function DjDashboard() {
  const tracks = useLibraryStore((s) => s.library?.tracks ?? []);
  const stats = useMemo(() => computeStats(tracks), [tracks]);

  if (stats.total === 0) return null;

  const bpmMax = Math.max(1, ...stats.bpmHistogram.map((b) => b.count));
  const camMax = Math.max(1, ...stats.camelotHistogram.map((c) => c.count));
  const enMax = Math.max(1, ...stats.energyHistogram.map((e) => e.count));

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={<Music className="h-3 w-3" />}
          label="Morceaux"
          value={stats.total.toLocaleString()}
          hint={`${stats.analyzed.toLocaleString()} analysés`}
        />
        <Stat
          icon={<Clock className="h-3 w-3" />}
          label="Durée totale"
          value={formatTotalDuration(stats.totalDurationSec)}
        />
        <Stat
          icon={<Gauge className="h-3 w-3" />}
          label="BPM moyen"
          value={stats.bpmAvg != null ? stats.bpmAvg.toFixed(0) : "—"}
          hint={
            stats.bpmMin != null && stats.bpmMax != null
              ? `${stats.bpmMin.toFixed(0)} → ${stats.bpmMax.toFixed(0)}`
              : undefined
          }
        />
        <Stat
          icon={<Sparkles className="h-3 w-3" />}
          label="Tonalité dominante"
          value={
            stats.dominantCamelot ? (
              <CamelotBadge code={stats.dominantCamelot} size="sm" />
            ) : (
              "—"
            )
          }
        />
      </div>

      {/* BPM histogram */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-[var(--primary-glow)]" />
          <span className="text-sm font-medium">Répartition BPM</span>
        </div>
        <div className="space-y-1.5">
          {stats.bpmHistogram.map((b) => {
            const pct = (b.count / bpmMax) * 100;
            return (
              <div key={b.label} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 text-muted-foreground tabular-nums">
                  {b.label}
                </span>
                <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${pct}%`,
                      background: "var(--gradient-primary)",
                    }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-muted-foreground tabular-nums">
                  {b.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Camelot wheel distribution */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Roue Camelot</span>
          <span className="text-[10px] text-muted-foreground">
            Taille = nombre de morceaux
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {stats.camelotHistogram.map(({ code, count }) => {
            const tone = camelotTone(code);
            const intensity = count === 0 ? 0 : 0.35 + (count / camMax) * 0.65;
            return (
              <div
                key={code}
                className="flex flex-col items-center gap-0.5 rounded-md p-1 transition-transform hover:scale-105"
                title={`${code} · ${count} morceau${count > 1 ? "x" : ""}`}
                style={{
                  background:
                    count === 0
                      ? "var(--surface-elevated)"
                      : `color-mix(in oklch, ${tone.bg} ${Math.round(
                          intensity * 100,
                        )}%, transparent)`,
                }}
              >
                <span
                  className="text-[10px] font-bold tabular-nums leading-none"
                  style={{ color: count === 0 ? "var(--muted-foreground)" : tone.fg }}
                >
                  {code}
                </span>
                <span
                  className="text-[9px] tabular-nums leading-none"
                  style={{
                    color: count === 0 ? "var(--muted-foreground)" : tone.fg,
                    opacity: count === 0 ? 0.4 : 0.85,
                  }}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Energy distribution */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Niveaux d'énergie</span>
          {stats.energyAvg != null && (
            <span className="text-[10px] text-muted-foreground">
              Moyenne {Math.round(stats.energyAvg * 100)} %
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          {stats.energyHistogram.map((e) => {
            const tone = energyTone(e.bars);
            const heightPct = (e.count / enMax) * 100;
            return (
              <div
                key={e.bars}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${tone.label} · ${e.count}`}
              >
                <div className="relative h-20 w-full overflow-hidden rounded-md bg-[var(--surface-elevated)]">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-md transition-[height] duration-500"
                    style={{
                      height: `${Math.max(4, heightPct)}%`,
                      background: tone.color,
                      opacity: e.count === 0 ? 0.25 : 0.9,
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-semibold tabular-nums"
                  style={{ color: tone.color }}
                >
                  {e.count}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {e.bars}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
