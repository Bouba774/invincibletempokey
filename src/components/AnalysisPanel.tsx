import { useEffect, useState } from "react";
import { useLibraryStore } from "@/lib/library-store";
import { useAnalysisStore, formatETA } from "@/lib/analysis-store";
import { Activity, Play, Square, AlertTriangle, Disc3, ListOrdered, RefreshCw } from "lucide-react";
import { HarmonicMixing } from "./HarmonicMixing";
import { SetBuilder } from "./SetBuilder";
import { DjDashboard } from "./viz/DjDashboard";
import { confidenceLabel, confidenceTone } from "@/lib/corrections";

export function AnalysisPanel() {
  const library = useLibraryStore((s) => s.library);
  const selectedIds = useLibraryStore((s) => s.selectedIds);
  const tracks = library?.tracks ?? [];
  const total = tracks.length;
  const analyzed = tracks.filter((t) => t.analyzed).length;
  const errors = tracks.filter((t) => t.status === "error").length;
  const suspects = tracks.filter((t) => t.suspect && t.analyzed).length;
  const remaining = total - analyzed - errors;
  const pct = total === 0 ? 0 : Math.round(((analyzed + errors) / total) * 100);

  const running = useAnalysisStore((s) => s.running);
  const log = useAnalysisStore((s) => s.log);
  const start = useAnalysisStore((s) => s.start);
  const stop = useAnalysisStore((s) => s.stop);
  const reanalyzeIds = useAnalysisStore((s) => s.reanalyzeIds);
  const reanalyzeAll = useAnalysisStore((s) => s.reanalyzeAll);

  // Live ETA tick
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const eta = formatETA(useAnalysisStore.getState());
  const hasPendingWithFiles = tracks.some(
    (t) =>
      (t.status === "pending" || t.status === "error") &&
      !!useLibraryStore.getState().getFile(t.id),
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <DjDashboard />

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progression</span>
          <span className="text-sm tabular-nums text-[var(--primary-glow)]">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-elevated)]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {running
              ? `En cours · ETA ${eta}`
              : remaining > 0
                ? `${remaining.toLocaleString()} morceaux en attente`
                : "Tous les morceaux ont été analysés"}
            {errors > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-[var(--destructive,#ef4444)]">
                <AlertTriangle className="h-3 w-3" />
                {errors} erreur{errors > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {running ? (
            <button
              onClick={stop}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          ) : (
            <button
              onClick={() => void start()}
              disabled={!hasPendingWithFiles}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Play className="h-3.5 w-3.5" /> Lancer
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Fiabilité</span>
          {suspects > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              <AlertTriangle className="h-3 w-3" /> {suspects} à vérifier
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void reanalyzeIds(Array.from(selectedIds))}
            disabled={running || selectedIds.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
            Réanalyser la sélection ({selectedIds.size})
          </button>
          <button
            onClick={() => {
              const ids = tracks.filter((t) => t.suspect).map((t) => t.id);
              if (ids.length > 0) void reanalyzeIds(ids);
            }}
            disabled={running || suspects === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-40"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Réanalyser les suspects
          </button>
          <button
            onClick={() => void reanalyzeAll()}
            disabled={running || total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Réanalyser la bibliothèque
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Les valeurs verrouillées ne seront pas remplacées.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Activity className="h-4 w-4 text-[var(--primary-glow)]" />
          <span className="text-sm font-medium">Journal d'analyse</span>
        </div>
        <ul className="divide-y divide-border">
          {log.length === 0 && (
            <li className="px-4 py-6 text-sm text-muted-foreground text-center">
              Aucune analyse pour l'instant.
            </li>
          )}
          {log.slice(0, 30).map((e) => {
            const tone = confidenceTone(confidenceLabel(e.confidence));
            return (
              <li key={`${e.id}-${e.at}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${e.ok ? tone.text : "text-[var(--destructive,#ef4444)]"}`}
                  style={{ background: "currentColor" }}
                />
                <span className="flex-1 truncate text-muted-foreground">
                  {e.ok ? "Analysé : " : "Erreur : "}
                  <span className="text-foreground">{e.title}</span>
                  {!e.ok && e.message && <span className="ml-1 text-xs">({e.message})</span>}
                  {e.ok && e.suspect && (
                    <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                      à vérifier
                    </span>
                  )}
                </span>
                {e.ok && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {e.bpm ?? "—"} BPM · {e.camelot ?? "—"}
                    {e.confidence != null && (
                      <span className={`ml-1 ${tone.text}`}>{Math.round(e.confidence * 100)}%</span>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ListOrdered className="h-4 w-4 text-[var(--primary-glow)]" />
          <span className="text-sm font-medium">Set Builder</span>
        </div>
        <div className="p-3">
          <SetBuilder />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Disc3 className="h-4 w-4 text-[var(--primary-glow)]" />
          <span className="text-sm font-medium">Harmonic Mixing</span>
        </div>
        <div className="p-3">
          <HarmonicMixing />
        </div>
      </div>
    </div>
  );
}
