import { useMemo, useState, useRef } from "react";
import { toast } from "sonner";
import { useLibraryStore, type Track } from "@/lib/library-store";
import { usePlayerStore } from "@/lib/audio/player-store";
import { Play, Pause } from "lucide-react";
import { useOrderingStore, type OrderSource } from "@/lib/ordering-store";
import { buildSet, SET_PRESETS, type SetType } from "@/lib/setbuilder";
import { EnergyMeter } from "./viz/EnergyMeter";
import { CamelotBadge } from "./viz/CamelotBadge";
import {
  ListOrdered,
  Sunrise,
  Flame,
  Moon,
  Wand2,
  GripVertical,
  X,
  Plus,
  RefreshCw,
  Check,
} from "lucide-react";

const TYPE_ICONS: Record<SetType, React.ReactNode> = {
  auto: <Wand2 className="h-4 w-4" />,
  warmup: <Sunrise className="h-4 w-4" />,
  peak: <Flame className="h-4 w-4" />,
  closing: <Moon className="h-4 w-4" />,
};

function SetPlayBtn({ track }: { track: Track }) {
  const isCurrent = usePlayerStore((s) => s.currentId === track.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying && isCurrent);
  const play = usePlayerStore((s) => s.play);
  const toggle = usePlayerStore((s) => s.toggle);
  return (
    <button
      aria-label={isPlaying ? "Pause" : "Pré-écouter"}
      onClick={() => (isCurrent ? toggle() : void play(track))}
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

export function SetBuilder() {
  const library = useLibraryStore((s) => s.library);
  const tracks = library?.tracks ?? [];
  const setOrder = useOrderingStore((s) => s.setOrder);
  const analyzedCount = tracks.filter((t) => t.analyzed && t.bpm && t.camelot).length;

  const [activeType, setActiveType] = useState<SetType | null>(null);
  const [setTracks, setSetTracks] = useState<Track[]>([]);
  const [validated, setValidated] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  function promoteToActive() {
    if (!activeType || setTracks.length === 0) return;
    const src: OrderSource =
      activeType === "auto"
        ? "auto-mix"
        : activeType === "warmup"
          ? "setbuilder-warmup"
          : activeType === "peak"
            ? "setbuilder-peak"
            : "setbuilder-closing";
    const label = SET_PRESETS[activeType].label;
    setOrder(src, { ids: setTracks.map((t) => t.id), label });
    toast.success(`Ordre actif : ${label}`, {
      description: `${setTracks.length} morceaux appliqués à la bibliothèque.`,
    });
  }

  const generate = (type: SetType) => {
    const result = buildSet(type, tracks);
    setActiveType(type);
    setSetTracks(result);
    setValidated(false);
  };

  const removeAt = (idx: number) => {
    setSetTracks((arr) => arr.filter((_, i) => i !== idx));
  };

  // Drag & drop -------------------------------------------------------
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const onDragStart = (i: number) => (e: React.DragEvent) => {
    dragIndex.current = i;
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(i);
  };
  const onDrop = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndex.current;
    setOverIndex(null);
    dragIndex.current = null;
    if (from === null || from === i) return;
    setSetTracks((arr) => {
      const next = [...arr];
      const [m] = next.splice(from, 1);
      next.splice(i, 0, m);
      return next;
    });
  };

  // Available tracks to add ------------------------------------------
  const inSet = useMemo(() => new Set(setTracks.map((t) => t.id)), [setTracks]);
  const available = useMemo(
    () => tracks.filter((t) => t.analyzed && t.bpm && t.camelot && !inSet.has(t.id)),
    [tracks, inSet],
  );

  if (analyzedCount < 2) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
        <ListOrdered className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Analyse au moins 2 morceaux pour générer un set DJ.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(SET_PRESETS) as SetType[]).map((type) => {
          const meta = SET_PRESETS[type];
          const active = activeType === type;
          return (
            <button
              key={type}
              onClick={() => generate(type)}
              className={`flex items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)]/10"
                  : "border-border bg-card hover:bg-[var(--surface-elevated)]"
              }`}
            >
              <span
                className={`mt-0.5 ${active ? "text-[var(--primary-glow)]" : "text-muted-foreground"}`}
              >
                {TYPE_ICONS[type]}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium">{meta.label}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                  {meta.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {activeType && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[var(--primary-glow)]">{TYPE_ICONS[activeType]}</span>
              <div>
                <div className="text-sm font-medium">{SET_PRESETS[activeType].label}</div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {setTracks.length} morceau{setTracks.length > 1 ? "x" : ""}
                  {validated && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[var(--primary-glow)]">
                      <Check className="h-3 w-3" /> validé
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => generate(activeType)}
                title="Régénérer"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAddOpen((v) => !v)}
                title="Ajouter"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {setTracks.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Aucun morceau ne correspond à ce type de set.
            </div>
          ) : (
            <ol className="divide-y divide-border">
              {setTracks.map((t, i) => (
                <li
                  key={t.id}
                  draggable
                  onDragStart={onDragStart(i)}
                  onDragOver={onDragOver(i)}
                  onDrop={onDrop(i)}
                  onDragEnd={() => setOverIndex(null)}
                  className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                    overIndex === i ? "bg-[var(--primary)]/10" : ""
                  }`}
                >
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                  <span className="w-7 shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <CamelotBadge code={t.camelot} size="xs" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{t.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
                      <EnergyMeter track={t} />
                      <span>{t.bpm ?? "—"} BPM</span>
                      <span className="text-border">·</span>
                      <span>{t.duration ?? "—"}</span>
                    </div>
                  </div>
                  <SetPlayBtn track={t} />
                  <button
                    onClick={() => removeAt(i)}
                    aria-label="Retirer"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ol>
          )}

          {addOpen && available.length > 0 && (
            <div className="border-t border-border p-2">
              <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                Ajouter depuis la bibliothèque
              </div>
              <ul className="max-h-56 overflow-y-auto">
                {available.slice(0, 80).map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => {
                        setSetTracks((arr) => [...arr, t]);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-elevated)]"
                    >
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{t.title}</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {t.bpm} · {t.camelot}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {setTracks.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-2">
              <button
                onClick={() => {
                  setActiveType(null);
                  setSetTracks([]);
                  setValidated(false);
                }}
                className="rounded-lg border border-border bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                Annuler
              </button>
              <button
                onClick={() => setValidated(true)}
                className="rounded-lg border border-border bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                Valider le set
              </button>
              <button
                onClick={promoteToActive}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)]"
                style={{ background: "var(--gradient-primary)" }}
              >
                Utiliser comme ordre principal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
