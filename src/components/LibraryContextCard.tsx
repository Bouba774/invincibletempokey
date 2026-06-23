import { Link } from "@tanstack/react-router";
import { Library as LibraryIcon, FolderSync, CheckCircle2, Loader2, CircleDashed } from "lucide-react";
import { useLibraryStore } from "@/lib/library-store";
import { useAnalysisStore } from "@/lib/analysis-store";

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const day = 86_400_000;
  if (diff < day && new Date(ts).toDateString() === new Date().toDateString()) {
    return "aujourd'hui";
  }
  if (diff < 2 * day) return "hier";
  const days = Math.floor(diff / day);
  if (days < 7) return `il y a ${days} j`;
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function LibraryContextCard() {
  const library = useLibraryStore((s) => s.library);
  const running = useAnalysisStore((s) => s.running);
  if (!library) return null;

  const total = library.tracks.length;
  const analyzed = library.tracks.filter((t) => t.analyzed).length;
  const pending = total - analyzed;

  let stateLabel: string;
  let StateIcon = CheckCircle2;
  let stateColor = "text-[var(--accent)]";
  if (running) {
    stateLabel = `Analyse en cours · ${analyzed}/${total}`;
    StateIcon = Loader2;
    stateColor = "text-[var(--primary-glow)]";
  } else if (pending > 0) {
    stateLabel = `${pending} en attente d'analyse`;
    StateIcon = CircleDashed;
    stateColor = "text-muted-foreground";
  } else if (total === 0) {
    stateLabel = "Bibliothèque vide";
    StateIcon = CircleDashed;
    stateColor = "text-muted-foreground";
  } else {
    stateLabel = "Analyse terminée";
  }

  return (
    <section className="px-4 pt-4">
      <div className="surface-card relative overflow-hidden rounded-2xl border border-border bg-[var(--surface-elevated)] p-4">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-primary)" }}
        />
        <div className="relative flex items-start gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[var(--primary-foreground)] shadow-[var(--shadow-glow,0_0_0_0)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            <LibraryIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Bibliothèque active
            </div>
            <h1 className="mt-0.5 truncate font-display text-lg font-semibold tracking-tight text-foreground">
              {library.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
              <span className="font-medium text-foreground">
                {total.toLocaleString("fr-FR")} morceaux
              </span>
              <span className="text-border">·</span>
              <span className={`inline-flex items-center gap-1 ${stateColor}`}>
                <StateIcon className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
                {stateLabel}
              </span>
              <span className="text-border">·</span>
              <span>Importée {formatRelative(library.createdAt)}</span>
            </div>
          </div>
          <Link
            to="/"
            aria-label="Changer de bibliothèque"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-[var(--surface)] text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/40 transition-colors"
          >
            <FolderSync className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
