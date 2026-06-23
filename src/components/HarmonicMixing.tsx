import { useMemo } from "react";
import { toast } from "sonner";
import { useLibraryStore, type Track } from "@/lib/library-store";
import { useOrderingStore, type OrderSource } from "@/lib/ordering-store";
import {
  getSuggestions,
  type Suggestion,
} from "@/lib/harmonic";
import { Disc3, Sparkles, Waves, Flame, ArrowRight, X, CheckCheck, Play, Pause } from "lucide-react";
import { usePlayerStore } from "@/lib/audio/player-store";
import { CamelotBadge } from "./viz/CamelotBadge";
import { EnergyMeter } from "./viz/EnergyMeter";
import { CompatibilityBadge } from "./viz/CompatibilityBadge";

function PlayBtn({ track }: { track: Track }) {
  const isCurrent = usePlayerStore((s) => s.currentId === track.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying && isCurrent);
  const play = usePlayerStore((s) => s.play);
  const toggle = usePlayerStore((s) => s.toggle);
  return (
    <button
      aria-label={isPlaying ? "Pause" : "Pré-écouter"}
      onClick={(e) => {
        e.stopPropagation();
        if (isCurrent) toggle();
        else void play(track);
      }}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-transform active:scale-95 ${
        isCurrent
          ? "text-[var(--primary-foreground)]"
          : "bg-[var(--surface-elevated)] text-[var(--primary-glow)] hover:bg-[var(--primary)]/20"
      }`}
      style={isCurrent ? { background: "var(--gradient-primary)" } : undefined}
    >
      {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 translate-x-[1px]" />}
    </button>
  );
}

function SuggestionRow({ s, source }: { s: Suggestion; source: Track }) {
  const bpmDelta =
    source.bpm && s.track.bpm ? s.track.bpm - source.bpm : null;
  return (
    <li className="group flex items-center gap-3 rounded-lg border border-border bg-[var(--surface-elevated)] px-3 py-2 transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 hover:translate-x-0.5">
      <CamelotBadge code={s.track.camelot} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">{s.track.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
          <span>{s.track.bpm ?? "—"} BPM</span>
          {bpmDelta !== null && bpmDelta !== 0 && (
            <span
              className={`rounded px-1 ${
                bpmDelta > 0
                  ? "bg-[var(--primary)]/15 text-[var(--primary-glow)]"
                  : "bg-[var(--surface-elevated)] text-muted-foreground"
              }`}
            >
              {bpmDelta > 0 ? "+" : ""}
              {bpmDelta.toFixed(0)}
            </span>
          )}
          <EnergyMeter track={s.track} />
          <CompatibilityBadge source={source} target={s.track} compact />
        </div>
      </div>
      <PlayBtn track={s.track} />
    </li>
  );
}

function Section({
  icon,
  title,
  hint,
  items,
  source,
  empty,
  onApply,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  items: Suggestion[];
  source: Track;
  empty: string;
  onApply?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[var(--primary-glow)]">{icon}</span>
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hint && <span className="hidden sm:inline text-[11px] text-muted-foreground">{hint}</span>}
          {onApply && items.length > 0 && (
            <button
              onClick={onApply}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--primary-glow)] hover:bg-[var(--primary)]/20"
            >
              <CheckCheck className="h-3 w-3" /> Appliquer
            </button>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-5 text-center text-xs text-muted-foreground">{empty}</div>
      ) : (
        <ul className="space-y-1.5 p-3">
          {items.map((s) => (
            <SuggestionRow key={s.track.id} s={s} source={source} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function HarmonicMixing() {
  const library = useLibraryStore((s) => s.library);
  const selectedIds = useLibraryStore((s) => s.selectedIds);
  const clear = useLibraryStore((s) => s.clearSelection);
  const setOrder = useOrderingStore((s) => s.setOrder);

  function applySuggestionList(
    src: OrderSource,
    label: string,
    items: Suggestion[],
    sourceTrack: Track,
  ) {
    const ids = [sourceTrack.id, ...items.map((s) => s.track.id)];
    setOrder(src, { ids, label });
    toast.success(`Ordre actif : ${label}`, {
      description: `${ids.length} morceaux en tête de bibliothèque.`,
    });
  }

  const source = useMemo<Track | null>(() => {
    if (!library) return null;
    const id = selectedIds.values().next().value as string | undefined;
    if (!id) return null;
    return library.tracks.find((t) => t.id === id) ?? null;
  }, [library, selectedIds]);

  const suggestions = useMemo(() => {
    if (!source || !library) return null;
    if (!source.analyzed || !source.camelot) return null;
    return getSuggestions(source, library.tracks);
  }, [source, library]);

  if (!source) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
        <Disc3 className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Sélectionne un morceau dans la bibliothèque pour voir ses transitions DJ.
        </p>
      </div>
    );
  }

  if (!source.analyzed || !source.camelot) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-center">
        <div className="text-sm font-medium">{source.title}</div>
        <p className="mt-2 text-xs text-muted-foreground">
          Ce morceau doit être analysé avant de proposer des transitions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 p-4 animate-fade-in">
        <div className="flex items-start gap-3">
          <CamelotBadge code={source.camelot} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{source.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
              <span>{source.bpm ?? "—"} BPM</span>
              <span className="text-border">·</span>
              <span>{source.key ?? "—"}</span>
              <EnergyMeter track={source} showLabel size="md" />
            </div>
          </div>
          <button
            onClick={clear}
            aria-label="Désélectionner"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {suggestions && (
        <>
          <Section
            icon={<ArrowRight className="h-4 w-4" />}
            title="Next Track recommandé"
            hint="cohérence harmonique + énergie"
            items={suggestions.next}
            source={source}
            empty="Pas assez de morceaux analysés pour une recommandation."
            onApply={() => applySuggestionList("harmonic-progressive", "Progressive Mix", suggestions.next, source)}
          />
          <Section
            icon={<Sparkles className="h-4 w-4" />}
            title="Compatible Tracks"
            hint="même clé ou adjacente"
            items={suggestions.compatible}
            source={source}
            empty="Aucun morceau compatible trouvé."
            onApply={() => applySuggestionList("harmonic-smooth", "Compatible Tracks", suggestions.compatible, source)}
          />
          <Section
            icon={<Waves className="h-4 w-4" />}
            title="Transitions douces"
            hint="BPM ±3%"
            items={suggestions.smooth}
            source={source}
            empty="Aucune transition douce disponible."
            onApply={() => applySuggestionList("harmonic-smooth", "Smooth Transition", suggestions.smooth, source)}
          />
          <Section
            icon={<Flame className="h-4 w-4" />}
            title="Transitions énergétiques"
            hint="montée d'énergie"
            items={suggestions.energetic}
            source={source}
            empty="Aucune montée d'énergie pertinente."
            onApply={() => applySuggestionList("harmonic-energy", "Energy Build", suggestions.energetic, source)}
          />
        </>
      )}
    </div>
  );
}