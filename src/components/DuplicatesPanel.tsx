import { useMemo, useState } from "react";
import { Copy, Trash2, EyeOff, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useLibraryStore, type Track } from "@/lib/library-store";
import { findDuplicates, type DuplicateGroup } from "@/lib/duplicates";

function fmtSize(n: number | null): string {
  if (!n) return "—";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export function DuplicatesPanel() {
  const library = useLibraryStore((s) => s.library);
  const removeTracks = useLibraryStore((s) => s.removeTracks);
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [keepers, setKeepers] = useState<Map<string, string>>(new Map());

  const groups = useMemo<DuplicateGroup[]>(() => {
    if (!library) return [];
    return findDuplicates(library.tracks);
  }, [library]);

  const visible = groups.filter((g) => !ignored.has(g.id));

  function pickDefault(g: DuplicateGroup): string {
    const explicit = keepers.get(g.id);
    if (explicit && g.tracks.some((t) => t.id === explicit)) return explicit;
    // largest size, then shortest filename
    const sorted = [...g.tracks].sort((a, b) => {
      const sa = a.size ?? 0;
      const sb = b.size ?? 0;
      if (sb !== sa) return sb - sa;
      return a.fileName.length - b.fileName.length;
    });
    return sorted[0].id;
  }

  async function applyGroup(g: DuplicateGroup) {
    const keepId = pickDefault(g);
    const toRemove = g.tracks.filter((t) => t.id !== keepId).map((t) => t.id);
    if (toRemove.length === 0) return;
    await removeTracks(toRemove);
    setIgnored((prev) => new Set(prev).add(g.id));
  }

  async function applyAll() {
    const removed = visible.reduce((n, g) => n + (g.tracks.length - 1), 0);
    for (const g of visible) await applyGroup(g);
    if (removed > 0) {
      toast.success(`${removed} doublon${removed > 1 ? "s" : ""} retiré${removed > 1 ? "s" : ""}`);
    }
  }

  if (!library) return null;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Groupes" value={visible.length} />
        <Stat label="Exacts" value={visible.filter((g) => g.kind === "exact").length} />
        <Stat label="Fichiers" value={visible.reduce((n, g) => n + g.tracks.length, 0)} />
      </div>

      {visible.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Conserve un fichier par groupe, retire les autres de la bibliothèque (le fichier sur le
            disque n'est pas supprimé).
          </p>
          <button
            onClick={() => void applyAll()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Nettoyer tout
          </button>
        </div>
      )}

      {visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-[var(--primary-glow)]" />
          <p className="mt-3 text-sm font-medium text-foreground">Bibliothèque propre</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Aucun doublon détecté pour le moment.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {visible.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            keepId={pickDefault(g)}
            onPickKeep={(id) => {
              setKeepers((prev) => new Map(prev).set(g.id, id));
            }}
            onApply={() => void applyGroup(g)}
            onIgnore={() => setIgnored((prev) => new Set(prev).add(g.id))}
          />
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}

function GroupCard({
  group,
  keepId,
  onPickKeep,
  onApply,
  onIgnore,
}: {
  group: DuplicateGroup;
  keepId: string;
  onPickKeep: (id: string) => void;
  onApply: () => void;
  onIgnore: () => void;
}) {
  return (
    <li className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Copy className="h-4 w-4 text-[var(--primary-glow)]" />
        <span
          className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${
            group.kind === "exact"
              ? "bg-[var(--destructive,#ef4444)]/15 text-[var(--destructive,#ef4444)]"
              : "bg-[var(--primary)]/15 text-[var(--primary-glow)]"
          }`}
        >
          {group.kind === "exact" ? "Exact" : "Probable"}
        </span>
        <span className="truncate text-sm font-medium flex-1">{group.key}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{group.tracks.length}</span>
      </div>
      <ul className="divide-y divide-border">
        {group.tracks.map((t) => (
          <DupRow key={t.id} track={t} keep={t.id === keepId} onPickKeep={() => onPickKeep(t.id)} />
        ))}
      </ul>
      <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
        <button
          onClick={onIgnore}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <EyeOff className="h-3.5 w-3.5" /> Ignorer
        </button>
        <button
          onClick={onApply}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)]"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Conserver 1, retirer {group.tracks.length - 1}
        </button>
      </div>
    </li>
  );
}

function DupRow({
  track,
  keep,
  onPickKeep,
}: {
  track: Track;
  keep: boolean;
  onPickKeep: () => void;
}) {
  return (
    <button
      onClick={onPickKeep}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        keep ? "bg-[var(--primary)]/10" : "hover:bg-accent"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full shrink-0 ${
          keep ? "bg-[var(--primary-glow)]" : "bg-border"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">{track.fileName}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
          <span>{track.bpm ?? "—"} BPM</span>
          <span className="text-border">·</span>
          <span>{track.camelot ?? "—"}</span>
          <span className="text-border">·</span>
          <span>{track.duration ?? "—"}</span>
          <span className="text-border">·</span>
          <span>{fmtSize(track.size)}</span>
        </div>
      </div>
      {keep && (
        <span className="text-[10px] font-semibold uppercase text-[var(--primary-glow)]">
          Conserver
        </span>
      )}
    </button>
  );
}
