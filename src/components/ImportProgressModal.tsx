import type { ImportProgress } from "@/lib/library-store";
import { Loader2, CheckCircle2 } from "lucide-react";

export function ImportProgressModal({ progress }: { progress: ImportProgress | null }) {
  if (!progress) return null;
  const labels: Record<ImportProgress["phase"], string> = {
    scan: "Scan des fichiers…",
    build: "Construction de la bibliothèque…",
    done: "Import terminé",
  };
  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.scanned / progress.total) * 100))
      : progress.phase === "done"
        ? 100
        : 0;
  const isDone = progress.phase === "done";
  return (
    <div className="android-fixed-layer fixed inset-0 z-50 grid place-items-center bg-background/80 px-6">
      <div
        className="w-full max-w-sm rounded-2xl border border-border p-6 text-center"
        style={{ background: "var(--gradient-surface)", boxShadow: "var(--shadow-elegant)" }}
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface-elevated)]">
          {isDone ? (
            <CheckCircle2 className="h-7 w-7 text-[var(--primary-glow)]" />
          ) : (
            <Loader2 className="h-7 w-7 animate-spin text-[var(--primary-glow)]" />
          )}
        </div>
        <div className="mt-4 text-base font-semibold text-foreground">{labels[progress.phase]}</div>
        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
          {progress.scanned.toLocaleString()} / {progress.total.toLocaleString()} fichiers
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-elevated)]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
          />
        </div>
      </div>
    </div>
  );
}